const webpack = require('webpack');

module.exports = {  

    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: ['babel-loader']
            },
            {
                test: /\.txt$/,
                use: 'raw-loader'
            },
            {
                test: /\.glsl$/,
                use: 'raw-loader'
            }
        ],
    },

    plugins: [
        new webpack.EnvironmentPlugin([
            'NODE_ENV'
        ]),
    ],

};
