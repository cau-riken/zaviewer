const path = require("path");

const webpack = require('webpack');

const fs = require('fs');

const MiniCssExtractPlugin = require('mini-css-extract-plugin');

const TerserPlugin = require('terser-webpack-plugin');


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
          compiler.hooks.compile.tap("ZAViewer_compile", () => {
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
      }),

    ]
      .concat(extractCSS ? [new MiniCssExtractPlugin(
        {
          //## when using devServer, css will always be served in output.publicPath
          //Note: in devmode, CSS is not extracted (see above)
          filename: production ? '../css/ZAViewer.css' : 'ZAViewer.css',

          chunkFilename: production ? '../css/zav-[contenthash].css' : '../css/zav-[contenthash].css'
        }
      )
      ]
        : []),

    entry: {
      main: "./src/js/main.tsx"
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
              presets: ["@babel/preset-env",
                "@babel/preset-react",
                //prevent transpiling dynamic imports to deferred requires
                // already included in @babel/preset-env ES2020 (babel >7.8)//  { exclude: ['proposal-dynamic-import'] }
              ]
            }
          }
        },

      ]
    },

    resolve: {
      extensions: [".tsx", ".ts", ".js"]
    },

    optimization: {
      minimize: true,
      minimizer: [
        new TerserPlugin({
          parallel: true,
          extractComments: {
            condition: /^\**!|@preserve|@license|@cc_on/i,
            banner: (licenseFile) => `
ZAViewer, Copyright 2021 RIKEN Center for Brain Science / Connectome Analysis Unit.
Licensed under the Apache License, Version 2.0.
Third party license information can be found in ${licenseFile}
`,
          },
          terserOptions: {
            // https://github.com/webpack-contrib/terser-webpack-plugin#terseroptions

          },
        })
      ]
    },

    output: {
      ...{
        // `path` is the folder where Webpack generates bundles
      path: path.resolve(__dirname, 'assets/js'),
      },
      ...production ?
        {
          // `filename` provides a template for naming your bundles (remember to use `[name]`)
          filename: 'main.js',

          // `chunkFilename` provides a template for naming code-split bundles (optional)
          chunkFilename: 'chunk-[contenthash].js',

          
          publicPath: './assets/js/',
        }
        :
        {

      filename: '[name].js',

      publicPath: '/assets/js',
        }
    },

    devServer: {
      static: {
        directory: './',
        watch: {
          ignored: [
            '**/node_modules'
          ]
        }
      },
      compress: true,
      port: 9000
    }

  }
};
