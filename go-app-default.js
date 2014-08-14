var go = {};
go;

go.utils = {};

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
go.init = function() {
    var vumigo = require('vumigo_v02');
    var InteractionMachine = vumigo.InteractionMachine;
    var GoMAMA = go.app.GoMAMA;


    return {
        im: new InteractionMachine(api, new GoMAMA())
    };
}();
