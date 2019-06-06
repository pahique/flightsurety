const path = require("path");
const CopyWebpackPlugin = require("copy-webpack-plugin");

module.exports = {
  mode: 'development',
  entry: "./src/index.js",
  output: {
    filename: "index.js",
    path: path.resolve(__dirname, "dist"),
  },
  // module: {
  //   rules: [
  //     {
  //       test: /\.css$/,
  //       use: ["style-loader", "css-loader"]
  //     },
  //     {
  //       test: /\.(png|svg|jpg|gif)$/,
  //       use: [
  //         'file-loader'
  //       ]
  //     },
  //     {
  //       test: /\.html$/,
  //       use: "html-loader",
  //       exclude: /node_modules/
  //     }
  //   ]
  // },
  plugins: [
    new CopyWebpackPlugin([{ from: "./src/index.html", to: "index.html" }]),
    new CopyWebpackPlugin([{ from: "./src/styles.css", to: "styles.css" }]),
    new CopyWebpackPlugin([{ from: "./src/flight.jpg", to: "flight.jpg" }]),
  ],
  devServer: { 
    contentBase: path.join(__dirname, "dist"), 
    compress: true 
  },
};
