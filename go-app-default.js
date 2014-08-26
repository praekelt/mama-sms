var go = {};
go;

go.SECONDS_IN_A_DAY = 24 * 60 * 60;
go.MILLISECONDS_IN_A_DAY = go.SECONDS_IN_A_DAY * 1000;
go.MILLISECONDS_IN_A_WEEK = go.MILLISECONDS_IN_A_DAY * 7;

go.utils = {

  month_of_year_to_week: function(month) {
    var m = parseInt(month, 10);
    var current_date = this.get_current_date();
    var present_year = current_date.getFullYear();
    var present_month = current_date.getMonth();

    // 9 month cut off for rolling over into next year.
    var year_offset = (m < present_month && (present_month - m) > 3)
              ? 1 : 0;

    var birth_date = new Date(Date.UTC(present_year + year_offset, m, 15));
    var check_poll_number = this.get_poll_number(birth_date);
    if (check_poll_number < 1) {
      var corrected_date = birth_date - ((1 - check_poll_number) * go.MILLISECONDS_IN_A_WEEK);
      birth_date = new Date(corrected_date + new Date().getTimezoneOffset());
    }
    return birth_date;
  },

  months_to_week: function(month) {
    var m = parseInt(month, 10);
    var week = (m - 1) * 4 + 1;
    var current_date = this.get_current_date();
    var birth_date = new Date(current_date - (week * go.MILLISECONDS_IN_A_WEEK));
    return birth_date;
  },

  get_current_date: function() {
    return new Date();
  },

  get_today_as_string: function() {
    var today_iso = this.get_current_date().toISOString();
    return today_iso.split('T')[0];
  },

  get_holodeck_timestamp: function() {
    // NOTE:  this is why any datestamp format other than ISO8601
    //      is a bad idea.
    var today = this.get_current_date().toISOString();
    var parts = today.split('T');
    var date = parts[0];
    var hms = parts[1].split('.')[0];
    return date + " " + hms;
  },

  get_last_monday: function(date) {
    var current_date = date || this.get_current_date();
    var offset = current_date.getDay() - 1 || 7;
    var monday = current_date - (offset * go.MILLISECONDS_IN_A_DAY);
    return new Date(monday);
  },

  calculate_weeks_remaining: function(birth_date) {
    var milliseconds_to_go = birth_date - this.get_last_monday();
    return Math.floor(milliseconds_to_go / go.MILLISECONDS_IN_A_WEEK);
  },

  get_poll_number: function(birth_date) {
    var weeks_to_go = this.calculate_weeks_remaining(birth_date);
    return 36 - weeks_to_go;
  },

  /*
  get_seq_send_keys: function() {
    if(!im.config.sequential_send_keys) {
      throw new MamaSMSError('sequential_send_keys config value missing');
    }
    return im.config.sequential_send_keys.map(function(key) {
      return 'scheduled_message_index_' + key;
    });
  },

  send_sms: function(im, to_addr, content) {
    var sms_tag = im.config.sms_tag;
    if (!sms_tag) return success(true);
    return im.api_request("outbound.send_to_tag", {
      to_addr: to_addr,
      content: content,
      tagpool: sms_tag[0],
      tag: sms_tag[1]
    });
  },
  */
  'bloody trailing': 'commas'
};

go.app = function() {

  var vumigo = require('vumigo_v02');
  var App = vumigo.App;

  var GoMAMA = App.extend(function(self) {
    App.call(self, 'states_start');
    var Choice = vumigo.states.Choice;
    var ChoiceState = vumigo.states.ChoiceState;
    var EndState = vumigo.states.EndState;

    var $ = self.$;

    self.make_fake_exit_menu = function(opts) {
      /*
      NOTE:

      This is required because in some scenarios this application is launched
      from an STK. Some phones' STK environments swallow the closing response
      we send via USSD. This isn't anything we control, it's a result of the
      STK standard being unclear about what STK implementers should do with a
      "close" response. As a result some phones show the closing text, others
      do not.

      This fake exit menu adds an extra screen to make the UX of this a bit
      less painful.

      Standard ->

        +-------------+
        | opts.text   | -> ... opts.next
        +-------------+

      Fake exit ->

       +-------------+    +------------+
       | opts.text   | -> | Thank you  | -> ... opts.next
       |             |    | Good bye   |
       | 1. Exit     |    |            |
       +-------------+    +------------+

      Now phones _without_ the quirk will be showing the 'Thank you Good bye'
      screen while phones _with_ the quirk will still provide the opportunity
      for users to understand that they've closed the session and it did
      not time out.
      */
      return function(name, creator_opts) {
        if (self.im.config.stk_fake_exit) {
          return new ChoiceState(name, {
            question: opts.text,
            choices: [
              new Choice('1', $('Exit'))
            ],
            next: {
              name: 'stk_end',
              creator_opts: opts
            }
          });
        }
        return new EndState(name, opts);
      };
    };

    self.states.add('stk_end', function (name, opts) {
      return new EndState(name, {
        text: $('Thank you, good bye.'),
        next: 'states_start'
      });
    });

    self.states.add('states_start', function (name, opts) {
      return self.im.api_request('optout.status', {
        address_type: "msisdn",
        address_value: self.im.user.addr
      }).then(function (result) {
        if(result.opted_out) {
          return self.states.create('opted_out');
        } else if (self.im.config.default_language) {
          return self.states.create('default_language');
        } else {
          return self.states.create('language_selection');
        }
      });
    });

    self.states.add('opted_out', function (name, opts) {
      return new ChoiceState(name, {
        question: $('You have previously opted-out of this service. ' +
                    'Do you want to opt-back in again?'),
        choices: [
          new Choice('yes', 'Yes please.'),
          new Choice('no', 'No thank you.')
        ],
        next: function (choice) {
          return choice.value == 'yes' ? 'opt_back_in' : 'remain_opted_out';
        }
      });
    });

    self.states.add('opt_back_in', function (name, opts) {
      return self.im.api_request('optout.cancel_optout', {
        address_type: 'msisdn',
        address_value: self.im.user.addr,
        message_id: self.im.msg.message_id
      }).then(function (result) {
        return new ChoiceState(name, {
          question: $('You have opted-back in to MAMA. Press 1 to continue.'),
          choices: [
            new Choice('1', 'Continue')
          ],
          next: 'states_start'
        });
      });
    });

    self.states.add('remain_opted_out',
      self.make_fake_exit_menu({
        next: 'states_start',
        text: $('You remain opted-out of MAMA.')
      })
    );

    self.states.add('language_selection', function (name, opts) {
      return new ChoiceState(name, {
        question: (
          self.im.config.custom_opening_copy || $(
          'To get MAMA messages, we need to ask you 4 questions. ' +
          'What language would you like?')),
        choices: [
          new Choice('english', 'English'),
          new Choice('zulu', 'Zulu'),
          new Choice('xhosa', 'Xhosa'),
          new Choice('afrikaans', 'Afrikaans'),
          new Choice('sotho', 'Sotho'),
          new Choice('setswana', 'Setswana')
        ],
        next: 'user_status'
      });
    });

    self.states.add('default_language', function (name, opts) {
      return new ChoiceState(name, {
        question: (
          self.im.config.custom_opening_copy || $(
            'To get MAMA messages, we need to ask you 2 questions. ' +
            'Would you like to continue and answer these?')),
        choices: [
          new Choice('yes', $('Yes please')),
          new Choice('no', $('No thanks'))
        ],
        next: function(choice) {
          return {
            'yes': 'user_status',
            'no': 'cancel'
          }[choice.value];
        }
      });
    });

    self.states.add('cancel',
      self.make_fake_exit_menu({
        next: 'states_start',
        text: $("To receive MAMA SMSs you will need to answer the questions.")
      })
    );

  });

  return {
    GoMAMA: GoMAMA
  };

}();

go.init = function() {
    var vumigo = require('vumigo_v02');
    var InteractionMachine = vumigo.InteractionMachine;
    var GoMAMA = go.app.GoMAMA;


    return {
        im: new InteractionMachine(api, new GoMAMA())
    };
}();
