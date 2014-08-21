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
  }
  */
};
