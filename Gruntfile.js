module.exports = function (grunt) {
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-mocha-test');
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-watch');

    grunt.initConfig({
        paths: {
            src: {
                'app': {
                    'default': 'src/default.js',
                    'kenya': 'src/kenya.js'
                },
                'default': [
                    'src/index.js',
                    'src/utils.js',
                    '<%= paths.src.app.default %>',
                    'src/init.js'
                ],
                'kenya': [
                    'src/index.js',
                    'src/utils.js',
                    '<%= paths.src.app.kenya %>',
                    'src/init.js'
                ],
                'all': [
                    'src/**/*.js'
                ]
            },
            dest: {
                'default': 'go-app-default.js',
                'kenya': 'go-app-kenya.js'
            },
            test: {
                'default': [
                    'test/setup.js',
                    'src/utils.js',
                    '<%= paths.src.app.default %>',
                    'test/default.test.js'
                ],
                'kenya': [
                    'test/setup.js',
                    'src/utils.js',
                    '<%= paths.src.app.kenya %>',
                    'test/kenya.test.js'
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
            test_kenya: {
                src: ['<%= paths.test.kenya %>']
            }
        }
    });

    grunt.registerTask('test', [
        'jshint',
        'build',
        'mochaTest'
    ]);

    grunt.registerTask('build', [
        'concat'
    ]);

    grunt.registerTask('default', [
        'build',
        'test'
    ]);
};
