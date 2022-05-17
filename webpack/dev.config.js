const path = require('path');
const merge = require('webpack-merge');
const baseConfig = require('./base.config.js');
const express = require("express");
const app = express();
const port = 5000;

module.exports = merge(baseConfig, {
    watch: true,
    watchOptions: {
        aggregateTimeout: 100
    },
    entry: [
        './src/dev.js',
    ],

    devtool: ['source-map', 'eval-source-map'][0],
  
    output: {
        libraryTarget: 'var',
        path: path.resolve(__dirname, '../build'),
        filename: 'FreightPacker-dev.js'
    }
});
app.use('/build', express.static(path.resolve(__dirname, '../build')));
app.use('/resources', express.static(path.resolve(__dirname, '../resources')));
app.use('/src', express.static(path.resolve(__dirname, '../src')));
app.use('/', express.static('example'));
app.listen(port, () => console.log(`listening on port ${port}!`));