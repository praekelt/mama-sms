var vumigo = require("vumigo_v01");
var zlib = require('zlib');
var jed = require('jed');

if (typeof api === "undefined") {
    // testing hook (supplies api when it is not passed in by the real sandbox)
    var api = this.api = new vumigo.dummy_api.DummyApi();
}

var EndState = vumigo.states.EndState;
var ChoiceState = vumigo.states.ChoiceState;
var PaginatedChoiceState = vumigo.states.PaginatedChoiceState;
var Choice = vumigo.states.Choice;
var LanguageChoice = vumigo.states.LanguageChoice;
var InteractionMachine = vumigo.state_machine.InteractionMachine;
var StateCreator = vumigo.state_machine.StateCreator;
var Promise = vumigo.promise.Promise;
var success = vumigo.promise.success;

/**

NOTE:

The various date mangling functions in this code have been copied over
from the original vxpolls.multipoll_example Python code and rewritten
in Javascript.

**/

function MamaSMSError(msg) {
    var self = this;
    self.msg = msg;

    self.toString = function() {
        return "<MamaSMSError: " + self.msg + ">";
    };
}

var stack_values = function(label, stack) {
    return function(value) {
        stack.push([label, value]);
        return stack;
    };
};

var wrap = function (wrapped_promise) {
    return function() {
        return wrapped_promise;
    };
};


function MamaSMS() {
    var self = this;
    // The first state to enter
    StateCreator.call(self, 'optstatus');

    var _ = new jed({});

    var SECONDS_IN_A_DAY = 24 * 60 * 60;
    var MILLISECONDS_IN_A_DAY = SECONDS_IN_A_DAY * 1000;
    var MILLISECONDS_IN_A_WEEK = MILLISECONDS_IN_A_DAY * 7;

    var HOLODECK_PUSH_DATE_KEY = 'holodeck_push_date';
    var HOLODECK_URL = 'http://holodeck.praekelt.com/api/store/';


    // NOTE:    These are assigned to `self.` so I can reference them in tests.

    // MAMA SMS HIV Messages
    self.SMS_HIV_GROUP_KEY = '2a61b964313841358b2b601d93fc0704';
    // MAMA SMS General Messages
    self.SMS_STD_GROUP_KEY = '0984b7527c444522ae27ec61fa22e4b6';
    // MAMA SMS - All Known Contacts
    self.SMS_GROUP_KEY = '4dcffa1d5ffa4ab58b3fb6fa00afb910';


    // MAMA USSD HIV Messages
    self.USSD_HIV_GROUP_KEY = '9d676f7e0ffc48d3942d90c85568bec9';
    // MAMA USSD General Messages
    self.USSD_STD_GROUP_KEY = '174ac354c38d445db5d782c900c1d32d';
    // MAMA USSD - All Known Contacts
    self.USSD_GROUP_KEY = '38edc8c350f249ea894bdbea8b746dd4';


    // *120*2112# conversation key
    self.USSD_CONVERSATION_KEY = '82aaf6c7d8444b47ac93e308bc62dc35';
    // *120*2112*1# conversation key
    self.SMS_CONVERSATION_KEY = '589c9483dff34f339add3cbc66621d01';


    // Holodeck API keys
    self.HOLODECK_SMS_MESSAGING_TYPE_PIE_CHART = '92b963b824f1478cb31fb06f4d6bda36';
    self.HOLODECK_USSD_MESSAGING_TYPE_PIE_CHART = 'ed92ab0325144967b4eb1d94c6900390';

    self.HOLODECK_SMS_CUMULATIVE_SIGN_UPS_LINE_CHART = '98f333be830d40afaba49dd94197a8c7';

    self.HOLODECK_USSD_CUMULATIVE_SIGN_UPS_LINE_CHART = 'f10dd224e10c4693aad9e93b7b8ec0ef';
    self.HOLODECK_USSD_MESSAGE_COUNTS_LINE_CHART = '2f7a505fd2db455f8e5d659196066b67';
    self.HOLODECK_SMS_MESSAGE_COUNTS_LINE_CHAR = 'dd504ace2fbf462b97cd2bb8642e36a8';

    self.month_of_year_to_week = function(month) {
        var m = parseInt(month, 10);
        var current_date = self.get_current_date();
        var present_year = current_date.getFullYear();
        var present_month = current_date.getMonth();
        var last_monday = self.get_last_monday();
        var year_offset = 0;
        if (m < present_month) year_offset = 1;
        var birth_date = new Date(present_year + year_offset, m, 15);
        var check_poll_number = self.get_poll_number(birth_date);
        if (check_poll_number < 1) {
            var corrected_date = birth_date - ((1 - check_poll_number) * MILLISECONDS_IN_A_WEEK);
            birth_date = new Date(corrected_date);
        }
        return birth_date;
    };

    self.months_to_week = function(month) {
        var m = parseInt(month, 10);
        var week = (m - 1) * 4 + 1;
        var current_date = self.get_current_date();
        var last_monday = self.get_last_monday();
        var birth_date = new Date(current_date - (week * MILLISECONDS_IN_A_WEEK));
        return birth_date;
    };

    self.get_current_date = function() {
        return new Date();
    };

    self.get_today_as_string = function() {
        var today_iso = self.get_current_date().toISOString();
        return today_iso.split('T')[0];
    };

    self.get_holodeck_timestamp = function() {
        // NOTE:    this is why any datestamp format other than ISO8601
        //          is a bad idea.
        var today = self.get_current_date().toISOString();
        var parts = today.split('T');
        var date = parts[0];
        var hms = parts[1].split('.')[0];
        return date + " " + hms;
    };

    self.get_last_monday = function() {
        var current_date = self.get_current_date();
        var offset = current_date.getDay();
        var monday = current_date - (offset * MILLISECONDS_IN_A_DAY);
        return new Date(monday);
    };

    self.calculate_weeks_remaining = function(birth_date) {
        var milliseconds_to_go = birth_date - self.get_last_monday();
        return Math.floor(milliseconds_to_go / MILLISECONDS_IN_A_WEEK);
    };

    self.get_poll_number = function(birth_date) {
        var weeks_to_go = self.calculate_weeks_remaining(birth_date);
        return 36 - weeks_to_go;
    };

    self.add_creator('optstatus', function (state_name, im) {
        var p = im.api_request('optout.status', {
            address_type: "msisdn",
            address_value: im.user_addr
        });
        p.add_callback(function (result) {

            if(result.opted_out) {
                return new ChoiceState(
                    state_name,
                    function(choice) {
                        return (choice.value == 'yes' ?
                                'opt_back_in' : 'remain_opted_out');
                    },
                    ('You have previously opted-out of this service. ' +
                     'Do you want to opt-back in again?'),
                    [
                        new Choice('yes', 'Yes please.'),
                        new Choice('no', 'No thank you.')
                    ]);
            }

            if(im.config.default_language) {
                return new ChoiceState(
                    'language_selection',
                    function(choice) {
                        return {
                            'yes': 'user_status',
                            'no': 'cancel'
                        }[choice.value];
                    },
                    im.config.custom_opening_copy || (
                        'To get MAMA messages, we need to ask you 2 questions. ' +
                        'Would you like to continue and answer these?'),
                    [
                        new Choice('yes', 'Yes please'),
                        new Choice('no', 'No thanks')
                    ]);
            } else {
                return new LanguageChoice(
                    'language_selection',
                    'user_status',
                    im.config.custom_opening_copy || (
                        'To get MAMA messages, we need to ask you 4 questions. '+
                        'What language would you like?'),
                    [
                        new Choice('english', 'English'),
                        new Choice('zulu', 'Zulu'),
                        new Choice('xhosa', 'Xhosa'),
                        new Choice('afrikaans', 'Afrikaans'),
                        new Choice('sotho', 'Sotho'),
                        new Choice('setswana', 'Setswana')
                    ]
                );
            }
        });
        return p;
    });

    self.add_creator('opt_back_in', function (state_name, im) {
        var p = im.api_request('optout.cancel_optout', {
            address_type: 'msisdn',
            address_value: im.user_addr
        });
        p.add_callback(function (result) {
            return new ChoiceState(
                state_name,
                'optstatus',
                'You have opted-back in to MAMA. Press 1 to continue.',
                [
                    new Choice('1', 'Continue')
                ]);
        });
        return p;
    });

    self.add_state(new ChoiceState(
        'user_status',
        function(choice) {
            var next_state = {
                'pregnant': 'expected_month',
                'baby': 'initial_age',
                'unknown': 'missed_period'
            }[choice.value];
            return next_state;
        },
        _.gettext('Are you pregnant, or do you have a baby?'),
        [
            new Choice('pregnant', _.gettext('Pregnant')),
            new Choice('baby', _.gettext('Baby')),
            new Choice('unknown', _.gettext('Don\'t know'))
        ]
    ));

    self.add_state(new PaginatedChoiceState(
        'expected_month',
        function(choice) {
            if(choice.value == 'unknown') {
                return 'go_to_clinic';
            } else {
                return im.config.skip_hiv_messages ? 'end' : 'hiv_messages';
            }
        },
        _.gettext('In what month is your baby due?'),
        [
            // Javascript months are counted from zero.
            new Choice(0, _.gettext('Jan')),
            new Choice(1, _.gettext('Feb')),
            new Choice(2, _.gettext('Mar')),
            new Choice(3, _.gettext('Apr')),
            new Choice(4, _.gettext('May')),
            new Choice(5, _.gettext('Jun')),
            new Choice(6, _.gettext('Jul')),
            new Choice(7, _.gettext('Aug')),
            new Choice(8, _.gettext('Sep')),
            new Choice(9, _.gettext('Oct')),
            new Choice(10, _.gettext('Nov')),
            new Choice(11, _.gettext('Dec')),
            new Choice('unknown', _.gettext('Don\'t know'))
        ],
        null,
        null,
        {
            options_per_page: 7
        }
    ));

    self.add_state(new ChoiceState(
        'initial_age',
        function(choice) {
            if (choice.value == 11) {
                return 'too_old';
            }
            return im.config.skip_hiv_messages ? 'end' : 'hiv_messages';
        },
        _.gettext('How many months old is your baby?'),
        [
            new Choice(1, '1'),
            new Choice(2, '2'),
            new Choice(3, '3'),
            new Choice(4, '4'),
            new Choice(5, '5'),
            new Choice(6, '6'),
            new Choice(7, '7'),
            new Choice(8, '8'),
            new Choice(9, '9'),
            new Choice(10, '10'),
            new Choice(11, _.gettext('11 or more'))
        ]
    ));

    self.add_state(new ChoiceState(
        'hiv_messages',
        'end',
        _.gettext('If you are HIV+ you can get SMSes with extra info for HIV+ moms. ' +
          'They may mention your status. Or, you can choose general SMSes only.'),
        [
            new Choice('hiv', _.gettext('HIV')),
            new Choice('general', _.gettext('General'))
        ]
    ));

    self.add_state(new ChoiceState(
        'missed_period',
        'get_tested',
        _.gettext('If you have missed a period and have 1 or more of these, do a ' +
          'pregnancy test: nausea or vomiting; tender breasts; often tired.'),
        [
            new Choice('more', _.gettext('Read more'))
        ]
    ));

    self.make_fake_exit_menu = function(next_state, message) {
        return function(state_name, im) {
            if(im.config.stk_fake_exit) {
                return new ChoiceState(
                    state_name, 'stk_end', message,
                    [
                        new Choice('1', 'Exit')
                    ]
                );
            } else {
                return new EndState(state_name, message, next_state);
            }
        };
    };

    self.add_creator('get_tested',
        self.make_fake_exit_menu(
            'optstatus',
            "Don't wait! The 1st pregnancy check-up must happen soon. Do the test as soon as possible at a clinic, or get 1 at a pharmacy."));

    self.add_creator('go_to_clinic',
        self.make_fake_exit_menu(
            'optstatus',
            ("To sign up, we need to know which month. Please go to the clinic to " +
                     "find out, and dial us again.")
        ));

    self.add_creator('too_old',
        self.make_fake_exit_menu(
            'optstatus',
            ("Sorry, MAMA SMSs are aimed at mothers of younger babies. " +
             "You can visit askmama.mobi to read useful info, and meet " +
             "other moms. Stay well.")
        ));

    self.add_creator('cancel',
        self.make_fake_exit_menu(
            'optstatus',
            ("To receive MAMA SMSs you will need to answer the questions.")));

    self.get_seq_send_keys = function() {
        if(!im.config.sequential_send_keys) {
            throw new MamaSMSError('sequential_send_keys config value missing');
        }
        return im.config.sequential_send_keys.map(function(key) {
            return 'scheduled_message_index_' + key;
        });
    };

    self.send_sms = function(im, to_addr, content) {
        var sms_tag = im.config.sms_tag;
        if (!sms_tag) return success(true);
        return im.api_request("outbound.send_to_tag", {
            to_addr: to_addr,
            content: content,
            tagpool: sms_tag[0],
            tag: sms_tag[1]
        });
    };

    self.add_creator('remain_opted_out',
        self.make_fake_exit_menu('optstatus', 'You remain opted-out of MAMA.'));

    self.add_creator('end', function(state_name, im) {
        var _ = im.i18n;
        var user_status = im.get_user_answer('user_status');
        var dob;
        switch(user_status) {
            case 'pregnant':
                dob = self.month_of_year_to_week(im.get_user_answer('expected_month')).toISOString();
                break;
            case 'baby':
                dob = self.months_to_week(im.get_user_answer('initial_age')).toISOString();
                break;
            default:
                im.log('Unknown user_status: ' + user_status);
                dob = 'unknown';
                break;
        }

        var p = im.api_request('contacts.get_or_create', {
            delivery_class: 'ussd',
            addr: im.user_addr
        });
        p.add_callback(function(result) {
            var contact = result.contact;
            var fields = {
                'mama-sms-user-status': user_status,
                'mama-sms-dob': dob,
                'mama-sms-language': im.config.default_language || im.get_user_answer('language_selection'),
                'mama-sms-hiv-messages': (
                    im.config.skip_hiv_messages ? 'general' : im.get_user_answer('hiv_messages')),
                'mama-sms-registration-date': self.get_current_date().toISOString()
            };
            // set the correct poll number for the given dob for
            // each of the seq-send keys
            var seq_send_keys = self.get_seq_send_keys();
            seq_send_keys.forEach(function(key) {
                fields[key] = Number(self.get_poll_number(new Date(dob))).toString();
            });
            return im.api_request('contacts.update_extras', {
                key: contact.key,
                fields: fields
            });
        });
        p.add_callback(function(result) {
            if(im.config.welcome_sms_copy) {
                return self.send_sms(im, im.user_addr, im.config.welcome_sms_copy);
            } else {
                return im.log(
                    'Note: welcome_sms_copy missing, not sending a welcome message.');
            }
        });
        p.add_callback(self.publish_to_holodeck_once_a_day);
        p.add_callback(function(r) {
            if(im.config.stk_fake_exit) {
                return new ChoiceState(
                    state_name,
                    'stk_end',
                    _.gettext('Thanks for joining MAMA. We\'ll start SMSing you this week.'),
                    [
                        new Choice('1', 'Exit')
                    ]
                );
            } else {
                return new EndState(
                    state_name,
                    _.gettext('Thanks for joining MAMA. We\'ll start SMSing you this week.'),
                    'optstatus'
                );
            }
        });
        return p;
    });

    self.add_state(new EndState(
        'stk_end',
        'Thank you, good bye.',
        'optstatus'));

    // check whether stats have been published to Holodeck today
    // yet or not.
    self.publish_to_holodeck_once_a_day = function() {
        // Skip pushing to holodeck if config.qa is set to true
        if(im.config.qa || im.config.skip_holodeck) {
            return success(true);
        }

        var p = im.api_request('kv.get', {
            key: HOLODECK_PUSH_DATE_KEY
        });
        p.add_callback(function(result) {
            im.log('last push ' + JSON.stringify(result));
            var today = self.get_today_as_string();
            if(result.value != today) {
                im.log('pushing for ' + today);
                var holodeck_push = self.publish_to_holodeck();
                holodeck_push.add_callback(function() {
                    return im.api_request('kv.set', {
                        key: HOLODECK_PUSH_DATE_KEY,
                        value: today
                    });
                });
                return holodeck_push;
            }
        });
        return p;
    };

    // publish to holodeck, guaranteed. Called by
    // publish_to_holodeck_once_a_day
    self.publish_to_holodeck = function() {
        var p = new Promise();
        p.add_callback(self.publish_values(
            self.HOLODECK_SMS_MESSAGING_TYPE_PIE_CHART, {
                'HIV': self.get_group_count(self.SMS_HIV_GROUP_KEY),
                'Standard': self.get_group_count(self.SMS_STD_GROUP_KEY)
            }));
        p.add_callback(self.publish_values(
            self.HOLODECK_USSD_MESSAGING_TYPE_PIE_CHART, {
                'HIV': self.get_group_count(self.USSD_HIV_GROUP_KEY),
                'Standard': self.get_group_count(self.USSD_STD_GROUP_KEY)
            }));
        p.add_callback(self.publish_values(
            self.HOLODECK_SMS_CUMULATIVE_SIGN_UPS_LINE_CHART, {
                'Registered Users': self.get_group_count(self.SMS_GROUP_KEY),
                'Unique MSISDNs seen': self.get_uniques_count(self.SMS_CONVERSATION_KEY)
            }));

        p.add_callback(self.publish_values(
            self.HOLODECK_USSD_CUMULATIVE_SIGN_UPS_LINE_CHART, {
                'Registered Users': self.get_group_count(self.USSD_GROUP_KEY),
                'Unique MSISDNs seen': self.get_uniques_count(self.USSD_CONVERSATION_KEY)
            }));
        p.add_callback(self.publish_values(
            self.HOLODECK_USSD_MESSAGE_COUNTS_LINE_CHART, {
                'Total Inbound Messages': self.get_inbound_message_count(self.USSD_CONVERSATION_KEY),
                'Total Outbound Messages': self.get_outbound_message_count(self.USSD_CONVERSATION_KEY)
            }));
        p.add_callback(self.publish_values(
            self.HOLODECK_SMS_MESSAGE_COUNTS_LINE_CHAR, {
                'Messages Sent': self.sum_message_counts(
                    self.get_outbound_message_count,
                    im.config.sequential_send_keys.concat(
                        im.config.extra_sms_stat_keys || [])),
                'Messages Received': self.sum_message_counts(
                    self.get_inbound_message_count,
                    im.config.sequential_send_keys.concat(
                        im.config.extra_sms_stat_keys || []))
            }
            ));
        p.callback();
        return p;
    };

    // push the samples, returns a function that can be passed in
    // as a callback to a Promise which expects the samples to
    // be pushed to Holodeck.
    self.push_holodeck_samples = function(api_key, timestamp) {
        return function(samples) {
            var data = {
                api_key: api_key,
                samples: samples,
                timestamp: timestamp
            };
            var p = im.log('Pushing: ' + JSON.stringify(data));
            p.add_callback(function() {
                return im.api_request('http.post', {
                    url: HOLODECK_URL,
                    headers: {
                        'Content-Type': ['application/json']
                    },
                    data: JSON.stringify(data)
                });
            });
            p.add_callback(function(result) {
                return im.log('Got response ' + JSON.stringify(result));
            });
            return p;
        };
    };

    self.get_group_count = function(group_key) {
        var p = im.api_request('groups.count_members', {
            key: group_key
        });
        p.add_callback(function(result) {
            return result.count;
        });
        return p;
    };

    self.get_uniques_count = function (conversation_key) {
        var p = im.api_request('messagestore.count_outbound_uniques', {
            conversation_key: conversation_key
        });
        p.add_callback(function(result) {
            return result.count;
        });
        return p;
    };

    self.get_inbound_message_count = function (conversation_key) {
        var p = im.api_request('messagestore.count_replies', {
            conversation_key: conversation_key
        });
        p.add_callback(function(result) {
            return result.count;
        });
        return p;
    };

    self.sum_message_counts = function (cb, conversation_keys) {
        var p = new Promise();
        var count_stack = [];
        conversation_keys.forEach(function (conversation_key) {
            p.add_callback(wrap(cb(conversation_key)));
            p.add_callback(stack_values(conversation_key, count_stack));
        });
        p.add_callback(function(stack) {
            // sum
            return stack.reduce(function (pv, cv) {
                // current value is [conv_key, count]
                return pv + cv[1];
            }, 0);
        });
        p.callback();
        return p;
    };

    self.get_outbound_message_count = function (conversation_key) {
        var p = im.api_request('messagestore.count_sent_messages', {
            conversation_key: conversation_key
        });
        p.add_callback(function(result) {
            return result.count;
        });
        return p;
    };

    self.publish_values = function (api_key, values) {
        /*

        values is a {'label': value_promise} dictionary

        */
        return function() {
            var p = new Promise();
            var value_stack = [];

            for(var label in values) {
                var value_promise = values[label];
                p.add_callback(wrap(value_promise));
                p.add_callback(stack_values(label, value_stack));
            }
            p.add_callback(
                self.push_holodeck_samples(
                    api_key, self.get_holodeck_timestamp()));
            p.callback();
            return p;
        };
    };
}

// launch app
var states = new MamaSMS();
var im = new InteractionMachine(api, states);
im.attach();
