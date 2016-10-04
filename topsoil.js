const fs = require('fs');

var model = {
    pageData: null,
    pageDir: null,
    settings: null
};

var util = {
    // Build args for console output with prefix
    buildConsoleTxt: function(prefix, args) {
        var consoleTxtArgs = [prefix];

        for(var i in args) {
            consoleTxtArgs.push(args[i]);
        }

        return consoleTxtArgs;
    },

    // Read directory using Promise API
    readDir: function(dir) {
        return new Promise(function(resolve, reject) {
            fs.readdir(dir, (err, data) => {
                if(err) reject(err);
                resolve(data);
            });
        });
    },

    // Read file using Promise API
    readFile: function(fileName, encoding) {
        if(encoding === undefined) encoding = null;

        return new Promise(function(resolve, reject) {
            fs.readFile(fileName, encoding, (err, data) => {
                if(err) reject(err);
                resolve(JSON.parse(data));
            });
        });
    },

    // Output text to console error log prefixed with "[Topsoil]: ERROR -"
    errPrint: function() {
        console.error.apply(null, this.buildConsoleTxt('[Topsoil]: ERROR -', arguments));
    },

    // Output text to console log prefixed with "[Topsoil]:"
    logPrint: function() {
        console.log.apply(null, this.buildConsoleTxt('[Topsoil]:', arguments));
    }
};

module.exports = {
    build: function() {
        // Read settings
        util.readFile('settings.json').then(function(settings) {
            model.settings = settings;

            if(settings.pageDir === undefined) {
                settings.pageDir = 'page-data';
            }
            return util.readDir(settings.pageDir);
        }).then(function(pageDir) { // Read file names in page-data directory
            model.pageDir = pageDir;

            // Read page-data files
            return pageDir.reduce(function(sequence, fileName) {
                return sequence.then(function() {
                    return util.readFile(model.settings.pageDir+'/'+fileName, 'utf-8');
                }).then(function(data) {
                    if(model.pageData === null) {
                        model.pageData = {};
                    }

                    data['file-name'] = fileName;
                    model.pageData[fileName] = data;
                });
            }, Promise.resolve());
        }).then(function() {
            util.logPrint('SUCCESS -', model);

            return model;
        }).catch(function(err) {
            util.errPrint(err);
        });
    },

    test: function() {
        util.logPrint('Hello world!');
    }
};

if(process.argv[2] === 'test') {
    module.exports.test();
} else if(process.argv[2] === 'build') {
    module.exports.build();
} else {
    util.logPrint('No command line arguments passed.');
}

// var TemplateEngine = function(tpl, data) {
//     var match,
//         re = /<%(.+?)%>/g;

//     while(match = re.exec(tpl)) {
//         console.log(match);
//     }
// }
