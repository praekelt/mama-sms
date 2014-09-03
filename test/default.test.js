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

    it('should ask the expected month when pregnant', function () {
      return tester
        .setup.user.state('user_status')
        .input('1')
        .check.interaction({
          state: 'expected_month',
          reply: [
            'In what month is your baby due?',
            '1. Jan',
            '2. Feb',
            '3. Mar',
            '4. Apr',
            '5. May',
            '6. Jun',
            '7. Jul',
            '8. Aug',
            '9. More'
          ].join('\n')
        })
        .run();
    });

    describe('pre-natal registration', function () {

      describe('without HIV specific messaging', function () {
        beforeEach(function () {
          tester.setup.config.app({
            skip_hiv_messages: true
          });
        });

        it('should end if not providing HIV specific messaging', function () {
          return tester
            .setup.config.app({
              skip_hiv_messages: true
            })
            .setup.user.state('expected_month')
            .input('1')
            .check.interaction({
              state: 'end',
              reply: /Thanks for joining MAMA. We\'ll start SMSing you this week./
            })
            .run();
        });
      });

      it('should recommend going to the clinic when unsure about DOB', function () {
        return tester
          .setup.user.state({
            name: 'expected_month',
            metadata: {
              page_start: 8
            }
          })
          .input('5')
          .check.interaction({
            state: 'go_to_clinic',
            reply: /To sign up, we need to know which month/
          })
          .run();
      });

      it('should ask for HIV specific messaging opt-in when supplying DOB', function () {
        return tester
          .setup.user.state('expected_month')
          .input('1')
          .check.interaction({
            state: 'hiv_messages',
            reply: /If you are HIV\+ you can get SMSes with extra info/
          })
          .run();
      });

      it('should end when having answered the HIV+ question', function () {
        return tester
          .setup.user.state('hiv_messages')
          .input('1')
          .check.interaction({
            state: 'end'
          })
          .run();
      });
    });

    it('should ask the initial age when baby already born', function () {
      return tester
        .setup.user.state('user_status')
        .input('2')
        .check.interaction({
          state: 'initial_age',
          reply: /How many months old is your baby\?/
        })
        .run();
    });

    describe('when not sure about pregnancy', function () {

      it('should recommend a pregnancy test', function () {
        return tester
          .setup.user.state('user_status')
          .input('3')
          .check.interaction({
            state: 'missed_period',
            reply: /If you have missed a period/
          })
          .run();
      });

      it('should recommend getting tested', function () {
        return tester
          .setup.user.state('missed_period')
          .input('1')
          .check.interaction({
            state: 'get_tested',
            reply: [
              "Don't wait! The 1st pregnancy check-up must happen soon. ",
              "Do the test as soon as possible at a clinic, ",
              "or get 1 at a pharmacy."
            ].join("")
          })
          .run();
      });
    });
  });
});
