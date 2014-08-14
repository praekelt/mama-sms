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