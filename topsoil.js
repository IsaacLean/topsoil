'use strict';

const fs = require('fs');

const model = {
    pageData: null,
    pageDataDir: null,
    settings: null,
    tpl: null,
    tplDir: null
};

const util = {
    // Build args for console output with prefix
    buildConsoleTxt: function(prefix, args) {
        let consoleTxtArgs = [prefix];

        for(let i in args) {
            consoleTxtArgs.push(args[i]);
        }

        return consoleTxtArgs;
    },

    // Clean page data location
    cleanPageDataLoc: function(pageDataLoc) {
        pageDataLoc = pageDataLoc.split('/');

        let i;
        while((i = pageDataLoc.indexOf('') > -1)) {
            pageDataLoc.splice(i, 1);
        }

        return pageDataLoc.join('/');
    },

    // Output text to console error log prefixed with "[Topsoil]: ERROR -"
    errPrint: function() {
        let type = arguments[0].toUpperCase();

        if(type !== 'WARNING') {
            type = 'ERROR';
        }

        let args = [];

        for(let i=1; i<arguments.length; ++i) {
            args.push(arguments[i]);
        }

        console.error.apply(null, this.buildConsoleTxt('[Topsoil]: <'+type+'> - '+ args));
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
    readFile: function(fileLoc, encoding) {
        if(encoding === undefined) encoding = null;

        return new Promise(function(resolve, reject) {
            fs.readFile(fileLoc, encoding, (err, data) => {
                if(err) reject(err);
                resolve(data);
            });
        });
    },

    // Output text to console log prefixed with "[Topsoil]:"
    logPrint: function() {
        console.log.apply(null, this.buildConsoleTxt('[Topsoil]:', arguments));
    },

    // Create directory using Promise API
    mkdir: function(dirLoc) {
        return new Promise(function(resolve, reject) {
            fs.mkdir(dirLoc, function(err) {
                if(err) reject(err);
                resolve(dirLoc);
            });
        });
    },

    // Create directory if it is not found using Promise API
    chainMkdirIfNotFound: function(dirLoc) {
        let splitPageDataLoc = util.cleanPageDataLoc(dirLoc).split('/');
        let mkdirChain = [];

        for(let i in splitPageDataLoc) {
            let dir = [];

            for(let j=0; j <= i; ++j) {
                dir.push(splitPageDataLoc[j]);
            }

            if(dir.length > 0) {
                mkdirChain.push(dir.join('/'));
            }
        }

        // Read page data files
        return mkdirChain.reduce(function(sequence, dirLoc) {
            return sequence.then(function() {
                return new Promise(function(resolve, reject) {
                    fs.mkdir(dirLoc, function(err) {
                        if(err) {
                            if(err.code === 'EEXIST') {
                                util.errPrint('warning', '"'+dirLoc+'" already exists.');
                                resolve(dirLoc);
                            } else {
                                reject(err);
                            }
                        } else {
                            util.logPrint('"'+dirLoc+'" has been created.');
                            resolve('build');
                        }
                    });
                });
            });
        }, Promise.resolve());
    },

    // Write file using Promise API
    writeFile: function(fileLoc, content, encoding) {
        if(encoding === undefined) encoding = null;

        return new Promise(function(resolve, reject) {
            fs.writeFile(fileLoc, content, encoding, (err) => {
                if(err) {
                    reject(err);
                } else {
                    util.logPrint('"'+fileLoc+'" has written.');
                    resolve(fileLoc);
                }
            });
        });
    }
};

const tplEngine = function(tpl, pageData) {
    let match,
        re = /<%(.+?)%>/g,
        output = tpl;

    while(match = re.exec(output)) {
        output = output.replace(match[0], pageData.data[match[1]]);
    }

    return output;
};

module.exports = {
    build: function() {
        // Read settings
        util.readFile('settings.json').then(function(settings) {
            try {
                model.settings = JSON.parse(settings);
            } catch(err) {
                util.errPrint('warning', 'Error encountered while attempting to parse settings. Loading default settings instead.', err);
                model.settings = {};
            }
        }).catch(function() {
            model.settings = {}; // settings not found
        }).then(function() {
            return new Promise(function(resolve, reject) {
                // Set default directory names if they are undefined
                if(model.settings.buildDir === undefined) {
                    model.settings.buildDir = 'build';
                } else if(typeof model.settings.buildDir !== 'string') {
                    reject('"buildDir" value must be a string.');
                }

                if(model.settings.pageDataDir === undefined) {
                    model.settings.pageDataDir = 'page-data';
                } else if(typeof model.settings.pageDataDir !== 'string') {
                    reject('"pageDataDir" value must be a string.');
                }

                if(typeof model.settings.theme !== 'string') {
                    reject('"theme" value must be a string.');
                }

                resolve(model.settings.pageDataDir);
            });
        }).then(function(pageDataDir) {
            return util.readDir(pageDataDir);
        }).then(function(pageDataDir) { // Read file names in page data directory
            model.pageDataDir = pageDataDir;

            // Read page data files
            return pageDataDir.reduce(function(sequence, fileName) {
                return sequence.then(function() {
                    return util.readFile(model.settings.pageDataDir+'/'+fileName, 'utf-8');
                }).then(function(pageData) {
                    pageData = JSON.parse(pageData);

                    if(model.pageData === null) {
                        model.pageData = {};
                    }

                    pageData['file-name'] = fileName;
                    model.pageData[fileName] = pageData;
                });
            }, Promise.resolve());
        }).then(function() { // Read file names in template directory
            return util.readDir('themes/'+model.settings.theme+'/tpl');
        }).then(function(tplDir) {
            model.tplDir = tplDir;

            // Read template files
            return tplDir.reduce(function(sequence, fileName) {
                return sequence.then(function() {
                    return util.readFile('themes/'+model.settings.theme+'/tpl/'+fileName, 'utf-8');
                }).then(function(tpl) {
                    if(model.tpl === null) {
                        model.tpl = {};
                    }

                    model.tpl[fileName] = tpl;
                });
            }, Promise.resolve());
        }).then(function() {
            // Make build directory if it doesn't exist
            return util.chainMkdirIfNotFound(model.settings.buildDir);
        }).then(function() {
            // TODO: recursively remove files in existing buildDir

            // Write new build in buildDir
            return model.pageDataDir.reduce(function(sequence, pageDataFileName) {
                let pageData = model.pageData[pageDataFileName];

                return sequence.then(function() {
                    return new Promise(function(resolve, reject) {
                        if(typeof pageData.loc === 'string') {
                            if(pageData.loc.length > 0 && pageData.loc[0] === '/') {
                                resolve(model.settings.buildDir+pageData.loc);
                            } else {
                                reject('Page data location must at least be set to "/".');
                            }
                        } else {
                            reject('Page data location is not a string.');
                        }
                    });
                }).then(function(pageDataLoc) {
                    return util.chainMkdirIfNotFound(pageDataLoc);
                }).then(function() {
                    let pageData = model.pageData[pageDataFileName];
                    let pageDataLoc = util.cleanPageDataLoc(model.settings.buildDir+pageData.loc)+'/index.html';

                    return util.writeFile(pageDataLoc, tplEngine(model.tpl[pageData.tpl], pageData));
                });
            }, Promise.resolve());
        }).then(function() {
            util.logPrint('<BUILD SUCCESS> -', model);

            return model;
        }).catch(function(err) {
            util.errPrint('error', err);
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
    util.logPrint('No command line argument passed.');
}
