const path = require("path");

const webpack = require('webpack');

const fs = require('fs');

const MiniCssExtractPlugin = require('mini-css-extract-plugin');

const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');


//webpack v5.38.1
//invocation: webpack --node-env=production
module.exports = (env, argv) => {

  const production = process.env.NODE_ENV === 'production';

  //Extract CSS only when building production bundles
  const extractCSS = production;

  console.log(`production:${production}, extractCSS:${extractCSS}`);

  return {

    plugins: [

      {
        apply: (compiler) => {
          compiler.hooks.compile.tap("TIIViewer_compile", () => {
            //remove preexisting production CSS to prevent it being loaded in devMode
            const prodCss = path.resolve(__dirname, 'assets/css/ZAViewer.css');
            if (fs.existsSync(prodCss)) {
              console.log("Removing production assets:");
              console.log("\t", prodCss);
              fs.unlinkSync(prodCss);
            }
          });
        },
      },

      // workaround for issue in @blueprintjs/core v3.45.0 with webpack 5  
      // see  https://github.com/palantir/blueprint/issues/4393
      new webpack.DefinePlugin({
        "process.env": "{}",
        global: {}
      })

    ]
      .concat(extractCSS ? [new MiniCssExtractPlugin(
        {
          //## when using devServer, css will always be served in output.publicPath
          filename: production ? '../css/ZAViewer.css' : 'ZAViewer.css',

        }
      )
      ]
        : []),

    entry: {
      main: "./src/js/main.js"
    },

    module: {
      rules: [
        {
          test: /\.s?css$/,
          use: [

            extractCSS
              ?
              {
                loader: MiniCssExtractPlugin.loader,
                options: {
                },
              }

              // Creates `style` nodes from JS strings
              : 'style-loader'

            ,

            // Translates CSS into CommonJS
            'css-loader',

            // Compiles Sass to CSS          
            {
              loader: 'sass-loader',
              options: {
                sassOptions: {
                  minimize: true,
                  outputStyle: 'compressed'
                }
              }
            }
          ]
        },

        {
          test: /\.tsx?$/,
          exclude: /node_modules/,
          use: {
            loader: "ts-loader",
            options: {
              "transpileOnly": true
            }
          }
        },

        {
          test: /\.jsx?$/,
          exclude: /node_modules/,
          use: {
            loader: "babel-loader",
            options: {
              presets: ["@babel/preset-env", "@babel/preset-react"],
            }
          }
        },

      ]
    },

    resolve: {
      extensions: [".tsx", ".ts", ".js"]
    },

    optimization: {

    },

    output: {
      path: path.resolve(__dirname, 'assets/js'),

      filename: '[name].js',

      publicPath: '/assets/js',
    },


    devServer: {
      contentBase: './',
      compress: true,
      port: 9000
    }
    
  }
};
