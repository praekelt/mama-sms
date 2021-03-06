module.exports = function (grunt) {
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-mocha-test');
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-mocha-cov');

  grunt.initConfig({
    paths: {
      src: {
        'app': {
          'default': 'src/default.js',
          'rsa': 'src/default.js',
          'kenya': 'src/kenya.js',
          'utils': 'src/utils.js',
          'metrics': 'src/metrics.js'
        },
        'default': [
          'src/index.js',
          'src/constants.js',
          'src/utils.js',
          'src/metrics.js',
          '<%= paths.src.app.default %>',
          'src/init.js'
        ],
        'rsa': [
          'src/index.js',
          'src/constants.js',
          'src/utils.js',
          'src/holodeck.js',
          '<%= paths.src.app.default %>',
          'src/holodeck.js',
          'src/init.js'
        ],
        'kenya': [
          'src/index.js',
          'src/constants.js',
          'src/utils.js',
          '<%= paths.src.app.kenya %>',
          'src/init.js'
        ],
        'utils': [
          'src/index.js',
          'src/constants.js',
          'src/utils.js'
        ],
        'metrics': [
          'src/index.js',
          'src/constants.js',
          'src/metrics.js'
        ],
        'all': [
          'src/**/*.js'
        ]
      },
      dest: {
        'default': 'go-app-default.js',
        'rsa': 'go-app-rsa.js',
        'kenya': 'go-app-kenya.js'
      },
      test: {
        'default': [
          'test/setup.js',
          'src/constants.js',
          'src/utils.js',
          'src/metrics.js',
          '<%= paths.src.app.default %>',
          'test/default.test.js'
        ],
        'rsa': [
          'test/setup.js',
          'src/constants.js',
          'src/utils.js',
          'src/holodeck.js',
          '<%= paths.src.app.default %>',
          'test/default.test.js'
        ],
        'kenya': [
          'test/setup.js',
          'src/constants.js',
          'src/utils.js',
          '<%= paths.src.app.kenya %>',
          'test/kenya.test.js'
        ],
        'utils': [
          'test/setup.js',
          'src/constants.js',
          'src/utils.js',
          '<%= paths.src.app.utils %>',
          'test/utils.test.js'
        ],
        'metrics': [
          'test/setup.js',
          'src/constants.js',
          'src/metrics.js',
          '<%= paths.src.app.metrics %>',
          'test/metrics.test.js'
        ]
      }
    },

    jshint: {
      options: {jshintrc: '.jshintrc'},
      all: [
        'Gruntfile.js',
        '<%= paths.src.all %>'
      ]
    },

    watch: {
      src: {
        files: ['<%= paths.src.all %>'],
        tasks: ['build']
      }
    },

    concat: {
      'default': {
        src: ['<%= paths.src.default %>'],
        dest: '<%= paths.dest.default %>'
      },
      'rsa': {
        src: ['<%= paths.src.rsa %>'],
        dest: '<%= paths.dest.rsa %>'
      },
      'kenya': {
        src: ['<%= paths.src.kenya %>'],
        dest: '<%= paths.dest.kenya %>'
      }
    },

    mochaTest: {
      options: {
        reporter: 'spec'
      },
      test_default: {
        src: ['<%= paths.test.default %>']
      },
      test_rsa: {
        src: ['<%= paths.test.rsa %>']
      },
      test_kenya: {
        src: ['<%= paths.test.kenya %>']
      },
      test_utils :{
        src: ['<%= paths.test.utils %>']
      },
      test_metrics: {
        src: ['<%= paths.test.metrics %>']
      }
    },
    mochacov: {
      cov_default: {
        options: {
          files: [
            '<%= paths.test.default %>',
            '<%= paths.test.utils %>',
            '<%= paths.test.metrics %>'
          ],
          reporter: 'mocha-lcov-reporter',
          output: 'mochacov-default.lcov',
          coverage: true
        }
      }
    }
  });

  grunt.registerTask('test', [
    'jshint',
    'build',
    'mochaTest',
    'mochacov'
  ]);

  grunt.registerTask('build', [
    'concat'
  ]);

  grunt.registerTask('default', [
    'build',
    'test'
  ]);
};
