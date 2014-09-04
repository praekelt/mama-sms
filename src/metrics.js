var Q = require('q');

go.METRICS_PUSH_DATE = 'metrics_push_date';

go.metrics = {
  publish_daily_stats: function (im) {
    // check if metrics need to be skipped
    if(im.config.qa || im.config.skip_holodeck) {
      return Q(true);
    }

    var today = go.utils.get_today_as_string();

    return im
      .api_request('kv.get', { key: go.METRICS_PUSH_DATE })
      .get('value')
      .then(function (last_push_date) {
        if(last_push_date != today) {
          return go.metrics
              .publish_stats(im)
              .then(function () {
                return im.api_request('kv.set', {
                  key: go.METRICS_PUSH_DATE,
                  value: today
                });
              });
        }
      });
  },

  publish_stats: function (im) {
    return Q(true)
      .then(function () {
        return go.metrics.publish_group_counts(im, {
          group_name: im.config.group_name || 'Registered Users',
          metric_name: 'registered_users'
        });
      })
      .then(function () {
        return go.metrics.publish_uniques_counts(im, {
          conversation_key: im.config.conversation_key,
          metric_name: 'unique_msisdns'
        });
      })
      .then(function () {
        return go.metrics.publish_inbound_message_counts(im, {
          conversation_keys: (
            im.config.sequential_send_keys.concat(im.config.extra_sms_stat_keys || [])),
          metric_name: 'inbound_message_count'
        });
      })
      .then(function () {
        return go.metrics.publish_outbound_message_counts(im, {
          conversation_keys: (
            im.config.sequential_send_keys.concat(im.config.extra_sms_stat_keys || [])),
          metric_name: 'outbound_message_count'
        });
      });
  },

  get_metric_name: function (im, name) {
    return [im.config.metric_prefix, name].join('.');
  },

  publish_group_counts: function(im, opts) {
    return this
      .get_group_count(im, opts.group_name)
      .then(function (count) {
        return im
          .metrics.fire.max(go.metrics.get_metric_name(im, opts.metric_name), count);
      });
  },

  publish_uniques_counts: function(im, opts) {
    return this
      .get_uniques_count(im, opts.conversation_key)
      .then(function (count) {
        return im
          .metrics.fire.max(go.metrics.get_metric_name(im, opts.metric_name), count);
      });
  },

  publish_inbound_message_counts: function (im, opts) {
    return Q.all(opts.conversation_keys.map(function (conversation_key) {
      return im.api_request('messagestore.count_replies', {
        conversation_key: conversation_key
      }).get('count');
    }))
      .then(function (counts) {
        return im
          .metrics.fire.max(
            go.metrics.get_metric_name(im, opts.metric_name),
            go.metrics.sum(counts));
      });
  },

  publish_outbound_message_counts: function (im, opts) {
    return Q.all(opts.conversation_keys.map(function (conversation_key) {
      return im.api_request('messagestore.count_sent_messages', {
        conversation_key: conversation_key
      }).get('count');
    }))
      .then(function (counts) {
        return im
          .metrics.fire.max(
            go.metrics.get_metric_name(im, opts.metric_name),
            go.metrics.sum(counts));
      });
  },

  sum: function (values) {
    return values.reduce(function (previous, current) {
      return previous + current;
    }, 0);
  },

  get_group_count: function(im, group_name) {
      return im
        .groups.get(group_name)
        .then(function (group) {
          return im.groups.sizeOf(group);
        });
  },

  get_uniques_count: function (im, conversation_key) {
    return im
      .api_request('messagestore.count_outbound_uniques', {
        conversation_key: conversation_key
      }).get('count');
  },

  'bloody': 'commas'
};
