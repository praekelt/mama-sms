var vumigo = require('vumigo_v02');
var assert = require('assert');
var AppTester = vumigo.AppTester;

var optout = require('./resource.optout.js');
var DummyOptoutResource = optout.DummyOptoutResource;

describe("MAMA SMS", function() {
    describe("default behaviour", function() {
        var app;
        var tester;

        beforeEach(function() {
            app = new go.app.GoMAMA();
            tester = new AppTester(app);

            tester
              .setup(function(api) {

                var optout_resource = new DummyOptoutResource();
                optout_resource.optout_store = [
                  'msisdn:+27001'
                ];

                api.resources.add(optout_resource);
                api.resources.attach(api);
              });
        });

        describe('when opted out', function () {
          it('should check optout status on session start', function () {
            return tester
                .setup.user.addr('+27001')
                .start()
                .check.interaction({
                    state: 'opted_out',
                    reply: /You have previously opted-out/
                })
                .run();
          });

          it('should allow opting back in', function () {
            return tester
                .setup.user.addr('+27001')
                .setup.user.state('opted_out')
                .input('1')
                .check.interaction({
                    state: 'opt_back_in',
                    reply: /You have opted-back in/
                })
                .check(function (api) {
                  var optout_resource = api.resources.resources.optout;
                  assert.equal(optout_resource.optout_store.length, 0);
                })
                .run();
          });

          it('should allow remaining opted out', function () {
            return tester
                .setup.user.addr('+27001')
                .setup.user.state('opted_out')
                .input('2')
                .check.interaction({
                    state: 'remain_opted_out',
                    reply: /You remain opted-out/
                })
                .run();
          });

        });
    });
});
