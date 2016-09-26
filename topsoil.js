const fs = require('fs');

fs.readFile('settings.json', (err, data) => {
    if(err) throw err;

    var settings = JSON.parse(data);
    var file = settings.files[0];

    fs.readFile(file, 'utf-8', (err, data) => {
        if(err) throw err;

        console.log(data);
    });
});
