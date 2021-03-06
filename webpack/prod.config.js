const webpack = require('webpack');
const path = require('path');
const merge = require('webpack-merge');
const baseConfig = require('./base.config.js');
const express = require("express");
const app = express();
const port = 3000;
//const UglifyJSPlugin = require('uglifyjs-webpack-plugin')

const options = {
    embedDependencies: true,
    uglify: false
};

var prodPlugins = [];
if(options.embedDependencies) prodPlugins.push( new webpack.ProvidePlugin( { THREE: ['freight-packer-lib-bundle', 'THREE'] } ) );
if(options.uglify) prodPlugins.push( new webpack.ProvidePlugin( ) );

module.exports = merge(baseConfig, {

    entry: [
        './src/FreightPacker.js',
    ],

    //devtool: 'eval-source-map',
  
    plugins: prodPlugins,

    output: {
        library: 'FreightPacker',
        libraryTarget: 'umd',
        path: path.resolve(__dirname, '../build'),
        filename: 'FreightPacker.js',
    }

});

app.use('/build', express.static(path.resolve(__dirname, '../build')));
app.use('/resources', express.static(path.resolve(__dirname, '../resources')));
app.use('/', express.static('example'));
app.listen(port, () => console.log(`listening on port ${port}!`));
