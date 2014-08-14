go.init = function() {
    var vumigo = require('vumigo_v02');
    var InteractionMachine = vumigo.InteractionMachine;
    var GoMAMA = go.app.GoMAMA;


    return {
        im: new InteractionMachine(api, new GoMAMA())
    };
}();
