module.exports = {
  entry: './entrypoint.es6',
  output: {
    path: './build', // This is where images AND js will go
    publicPath: '/staticBuilds/', // This is used to generate URLs to e.g. images
    filename: 'bundle.js'
  },
  resolveLoader: {
    modulesDirectories: ['node_modules']
  },
  resolve: {
    root: path.resolve('./'), // allow js/... css/... img/... etc to resolve
    extensions: ['', '.js', '.es6', '.css']
  },
  module: {
    loaders: [
      // use ! to chain loaders
      { test: /\.es6$/, loader: 'babel-loader', query: {presets: ['es2015']}}
    ]
  }
}