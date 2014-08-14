var vumigo = require('vumigo_v02');
var AppTester = vumigo.AppTester;

describe("app", function() {
    describe("behaviour", function() {
        var app;
        var tester;

        beforeEach(function() {
            app = new go.app.GoMAMA();
            tester = new AppTester(app);
        });
    });
});
