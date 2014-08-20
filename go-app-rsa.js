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
        var year_offset = 0;
        if (m < present_month) year_offset = 1;
        var birth_date = new Date(Date.UTC(present_year + year_offset, m, 15));
        var check_poll_number = this.get_poll_number(birth_date);
        if (check_poll_number < 1) {
            var corrected_date = birth_date - ((1 - check_poll_number) * go.MILLISECONDS_IN_A_WEEK);
            birth_date = new Date(corrected_date);
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
        // NOTE:    this is why any datestamp format other than ISO8601
        //          is a bad idea.
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
    }
    */
};

go.app = function() {

    var vumigo = require('vumigo_v02');
    var App = vumigo.App;

    var GoMAMA = App.extend(function(self) {
        App.call(self, 'states_start');
    });

    return {
        GoMAMA: GoMAMA
    };

}();
var HOLODECK_PUSH_DATE_KEY = 'holodeck_push_date';
var HOLODECK_URL = 'http://holodeck.praekelt.com/api/store/';


go.holodeck = {

    // NOTE:    These are assigned to `self.` so I can reference them in tests.

    // MAMA SMS HIV Messages
    SMS_HIV_GROUP_KEY: '2a61b964313841358b2b601d93fc0704',
    // MAMA SMS General Messages
    SMS_STD_GROUP_KEY: '0984b7527c444522ae27ec61fa22e4b6',
    // MAMA SMS - All Known Contacts
    SMS_GROUP_KEY: '4dcffa1d5ffa4ab58b3fb6fa00afb910',


    // MAMA USSD HIV Messages
    USSD_HIV_GROUP_KEY: '9d676f7e0ffc48d3942d90c85568bec9',
    // MAMA USSD General Messages
    USSD_STD_GROUP_KEY: '174ac354c38d445db5d782c900c1d32d',
    // MAMA USSD - All Known Contacts
    USSD_GROUP_KEY: '38edc8c350f249ea894bdbea8b746dd4',


    // *120*2112# conversation key
    USSD_CONVERSATION_KEY: '82aaf6c7d8444b47ac93e308bc62dc35',
    // *120*2112*1# conversation key
    SMS_CONVERSATION_KEY: '589c9483dff34f339add3cbc66621d01',

    // Holodeck API keys
    HOLODECK_SMS_MESSAGING_TYPE_PIE_CHART: '92b963b824f1478cb31fb06f4d6bda36',
    HOLODECK_USSD_MESSAGING_TYPE_PIE_CHART: 'ed92ab0325144967b4eb1d94c6900390',

    HOLODECK_SMS_CUMULATIVE_SIGN_UPS_LINE_CHART: '98f333be830d40afaba49dd94197a8c7',

    HOLODECK_USSD_CUMULATIVE_SIGN_UPS_LINE_CHART: 'f10dd224e10c4693aad9e93b7b8ec0ef',
    HOLODECK_USSD_MESSAGE_COUNTS_LINE_CHART: '2f7a505fd2db455f8e5d659196066b67',
    HOLODECK_SMS_MESSAGE_COUNTS_LINE_CHAR: 'dd504ace2fbf462b97cd2bb8642e36a8',

    // check whether stats have been published to Holodeck today
    // yet or not.
    publish_to_holodeck_once_a_day: function() {
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
    },

    // publish to holodeck, guaranteed. Called by
    // publish_to_holodeck_once_a_day
    publish_to_holodeck: function() {
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
    },

    // push the samples, returns a function that can be passed in
    // as a callback to a Promise which expects the samples to
    // be pushed to Holodeck.
    push_holodeck_samples: function(api_key, timestamp) {
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
    },

    get_group_count: function(group_key) {
        var p = im.api_request('groups.count_members', {
            key: group_key
        });
        p.add_callback(function(result) {
            return result.count;
        });
        return p;
    },

    get_uniques_count: function (conversation_key) {
        var p = im.api_request('messagestore.count_outbound_uniques', {
            conversation_key: conversation_key
        });
        p.add_callback(function(result) {
            return result.count;
        });
        return p;
    },

    get_inbound_message_count: function (conversation_key) {
        var p = im.api_request('messagestore.count_replies', {
            conversation_key: conversation_key
        });
        p.add_callback(function(result) {
            return result.count;
        });
        return p;
    },

    sum_message_counts: function (cb, conversation_keys) {
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
    },

    get_outbound_message_count: function (conversation_key) {
        var p = im.api_request('messagestore.count_sent_messages', {
            conversation_key: conversation_key
        });
        p.add_callback(function(result) {
            return result.count;
        });
        return p;
    },

    publish_values: function (api_key, values) {
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
    }
};

go.init = function() {
    var vumigo = require('vumigo_v02');
    var InteractionMachine = vumigo.InteractionMachine;
    var GoMAMA = go.app.GoMAMA;


    return {
        im: new InteractionMachine(api, new GoMAMA())
    };
}();
