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

    describe('with a custom opening copy', function () {
      beforeEach(function () {
        tester
          .setup.config.app({
            custom_opening_copy: 'foo bar baz'
          });
      });

      it('should ask for the language preference with custom opening copy',
        function () {
          return tester
            .start()
            .check.interaction({
              state: 'language_selection',
              reply: /foo bar baz/
            })
            .run();
        });

      it('should select the default language if specified with custom opening', function () {
        return tester
          .setup.config.app({
            default_language: 'en'
          })
          .start()
          .check.interaction({
            state: 'default_language',
            reply: /foo bar baz/
          })
          .run();
      });
    });

    describe('with a default language specified', function () {

      beforeEach(function () {
        tester
          .setup.config.app({
            default_language: 'en'
          });
      });

      it('should go straight to the first screen', function () {
        return tester
          .start()
          .check.interaction({
            state: 'default_language',
            reply: /To get MAMA messages, we need to ask you 2 questions/
          })
          .run();
      });

      it('should allow the user to cancel', function () {
        return tester
          .setup.user.state('default_language')
          .input('2')
          .check.interaction({
            state: 'cancel',
            reply: /To receive MAMA SMSs you will need to answer the questions/
          })
          .run();
      });
    });

    it('should ask for the language preference', function () {
      return tester
        .start()
        .check.interaction({
          state: 'language_selection',
          reply: /To get MAMA messages/
        })
        .run();
    });

    it('should go to the pregnancy questions when selecting a language', function () {
      return tester
        .setup.user.state('language_selection')
        .input('1')
        .check.interaction({
          state: 'user_status',
          reply: /Are you pregnant, or do you have a baby\?/
        })
        .run();
    });

  });
});
