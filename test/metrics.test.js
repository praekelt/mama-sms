var assert = require('assert'),
    vumigo = require('vumigo_v02'),
    moment = require('moment'),
    messagestore = require('./resource.messagestore.js'),
    _ = require('lodash');

var DummyMessageStoreResource = messagestore.DummyMessageStoreResource;
var AppTester = vumigo.AppTester;

describe("go.metrics", function() {

  beforeEach(function () {
    app = new go.app.GoMAMA();
    tester = new AppTester(app);
    tester
      .setup.config.app({
        metric_prefix: 'foo',
        metric_store: 'test_store',
        sequential_send_keys: ['conv-foo', 'conv-bar'],
        conversation_metrics: [{
          conversation_key: 'bar',
          metric_prefix: 'bar'
        }],
        group_metrics: [ {
          group_name: 'Registered Users',
          metric_prefix: 'registered_users'
        }]
      })
      .setup(function(api) {
        var dms = new DummyMessageStoreResource();
        dms.inbound_uniques = 1;
        dms.outbound_uniques = 2;
        dms.replies = 3;
        dms.sent_messages = 4;

        api.resources.add(dms);
        api.resources.attach(api);
        api.groups.add({
          name: 'Registered Users',
          key: 'registered-users'
        });
      })
      .run();

    // patch the date we're working with in tests.
    go.utils.get_current_date = function() {
      return moment.utc('2014-09-01T00:00:00+00:00').toDate();
    };
  });


  it('should store the last push date if pushing the first time', function () {
    return app.im
      .api_request('kv.get', { key: go.METRICS_PUSH_DATE })
      .get('value')
      .then(function (last_push_date) {
        assert.equal(last_push_date, null);
      })
      .then(function () {
        var im = app.im;
        return go.metrics
          .publish_daily_stats(im)
          .then(function () {
            return im
              .api_request('kv.get', { key: go.METRICS_PUSH_DATE })
              .get('value')
              .then(function (last_push_date) {
                assert.equal(last_push_date, '2014-09-01');
              });
          });
      });
  });

  it('should store the last push date if pushing a day later', function () {
    return app.im
      .api_request('kv.set', {
        key: go.METRICS_PUSH_DATE,
        value: '2000-01-01'
      })
      .then(function () {
        var im = app.im;
        return go.metrics
          .publish_daily_stats(im)
          .then(function () {
            return im
              .api_request('kv.get', { key: go.METRICS_PUSH_DATE })
              .get('value')
              .then(function (last_push_date) {
                assert.equal(last_push_date, '2014-09-01');
              });
          });
      });
  });

  it('should publish metrics', function () {
    var im = app.im,
        api = app.im.api;

    return im
      .api_request('kv.set', {
        key: go.METRICS_PUSH_DATE,
        value: '2000-01-01'
      })
      .then(function () {
        return go.metrics
          .publish_daily_stats(im)
          .then(function () {
            var store = api.metrics.stores.test_store;

            assert.ok(_.isEqual(store['foo.registered_users'], {
              agg: 'max',
              values: [0]
            }));

            assert.ok(_.isEqual(store['foo.bar.uniques'], {
              agg: 'max',
              values: [2]
            }));

            assert.ok(_.isEqual(store['foo.bar.inbound'], {
              agg: 'max',
              values: [3]
            }));

            assert.ok(_.isEqual(store['foo.bar.outbound'], {
              agg: 'max',
              values: [4]
            }));
          });
      });
  });

});
