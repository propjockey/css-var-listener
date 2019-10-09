module.exports = function (grunt) {
  grunt.loadNpmTasks("grunt-steal")
  grunt.loadNpmTasks("grunt-eslint")
  grunt.loadNpmTasks("grunt-testee")

  grunt.initConfig({
    "steal-export": {
      dist: {
        steal: {
          config: "package.json!npm"
        },
        outputs: {
          "+cjs": {
            dest: moduleName => __dirname + "/dist/css-var-listener.cjs.js"
          },
          "+amd": {
            dest: moduleName => __dirname + "/dist/css-var-listener.amd.js"
          }
        }
      }
    },
    "global-dist": {
      dep: {
        cwd: "./",
        src: ["css-var-listener.js"],
        expand: true,
        dest: "dist/"
      }
    },
    "eslint": {
      options: {
        configFile: ".eslintrc.json"
      },
      target: ["Gruntfile.js", "css-var-listener.js", "test/**/*.js"]
    },
    "testee": {
      options: {
        reporter: "dot",
        browsers: ["firefox"],
        coverage: {
          ignore: ["node_modules", "dist"],
          reporters: ["lcov", "text", "html"]
        },
        "tunnel": {
          "type": "local"
        }
      },
      src: ["test/test.html"]
    }
  })
  grunt.registerMultiTask("global-dist", function () {
    this.files.forEach(file => {
      const code = grunt.file.read(file.src.toString())
      grunt.log.writeln((file.src + " -> " + "dist/css-var-listener.esm.js").grey)
      grunt.file.write("dist/css-var-listener.esm.js", code)
      grunt.log.writeln((file.src + " -> " + "dist/css-var-listener.global.js").grey)
      grunt.file.write("dist/css-var-listener.global.js", code.replace(/\nexport .*$/gm, ""))
    })
  })

  grunt.registerTask("build", ["steal-export", "global-dist"])
  grunt.registerTask("test", ["eslint", "testee"])
}
