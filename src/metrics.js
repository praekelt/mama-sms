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
    return Q.all([
      go.metrics.publish_group_metrics(im, im.config.group_metrics || []),
      go.metrics.publish_conversation_metrics(im, im.config.conversation_metrics || [])
    ]);
  },

  get_metric_name: function (im, name) {
    return [im.config.metric_prefix, name].join('.');
  },

  publish_group_metrics: function(im, group_metrics) {
    return Q.all(group_metrics.map(function (metric) {
      return go.metrics.publish_group_counts(im, metric);
    }));
  },

  publish_group_counts: function(im, opts) {
    return this
      .get_group_count(im, opts.group_name)
      .then(function (count) {
        return im
          .metrics.fire.max(go.metrics.get_metric_name(im, opts.metric_prefix), count);
      });
  },

  publish_conversation_metrics: function(im, conversation_metrics) {
    return Q.all(conversation_metrics.map(function (metric) {
      return Q.all([
          go.metrics.publish_uniques_count(im, {
            conversation_key: metric.conversation_key,
            metric_name: [metric.metric_prefix, 'uniques'].join('.')
          }),
          go.metrics.publish_inbound_message_count(im, {
            conversation_key: metric.conversation_key,
            metric_name: [metric.metric_prefix, 'inbound'].join('.')
          }),
          go.metrics.publish_outbound_message_count(im, {
            conversation_key: metric.conversation_key,
            metric_name: [metric.metric_prefix, 'outbound'].join('.')
          })
        ]);
    }));
  },

  publish_uniques_count: function(im, opts) {
    return this
      .get_uniques_count(im, opts.conversation_key)
      .then(function (count) {
        return im
          .metrics.fire.max(go.metrics.get_metric_name(im, opts.metric_name), count);
      });
  },

  publish_inbound_message_count: function (im, opts) {
    return this
      .get_inbound_message_count(im, opts.conversation_key)
      .then(function (count) {
        return im
          .metrics.fire.max(
            go.metrics.get_metric_name(im, opts.metric_name),
            count);
      });
  },

  publish_outbound_message_count: function (im, opts) {
    return this
      .get_outbound_message_count(im, opts.conversation_key)
      .then(function (count) {
        return im
          .metrics.fire.max(
            go.metrics.get_metric_name(im, opts.metric_name),
            count);
      });
  },

  get_group_count: function(im, group_name) {
    return im
      .groups.get(group_name)
      .then(function (group) {
        return im.groups.sizeOf(group);
      });
  },

  get_uniques_count: function (im, conversation_key) {
    return im.api_request('messagestore.count_outbound_uniques', {
      conversation_key: conversation_key
    }).get('count');
  },

  get_inbound_message_count: function (im, conversation_key) {
    return im.api_request('messagestore.count_replies', {
      conversation_key: conversation_key
    }).get('count');
  },

  get_outbound_message_count: function (im, conversation_key) {
    return im.api_request('messagestore.count_sent_messages', {
      conversation_key: conversation_key
    }).get('count');
  },

  'bloody': 'commas'
};
