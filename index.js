var os = require('os');
var path = require('path');
var fs = require('fs');
var builder = require('xmlbuilder');
var md5 = require('md5');



var TestNgReporter = function(baseReporterDecorator, config, logger, helper, formatError) {
  var log = logger.create('reporter.testng');
  var reporterConfig = config.testngReporter || {};
  var pkgName = reporterConfig.suite || '';
  var outputFile = helper.normalizeWinPath(path.resolve(config.basePath, reporterConfig.outputFile
      || 'testng-results.xml'));

  var xml;
  var suites;
  var groups = {};
  var group = {};
  var classNames = {};
  var classes;
  var tests;
  var pendingFileWritings = 0;
  var fileWritingFinished = function() {};
  var allMessages = [];

  baseReporterDecorator(this);

  this.adapters = [function(msg) {
    allMessages.push(msg);
  }];

  var initliazeXmlForBrowser = function(browser) {
    var timestamp = (new Date()).toISOString().substr(0, 19);
    var suite = suites[browser.id] = xml.ele('suite', {
      name: browser.name
    });
    group[browser.id] = suite.ele('groups');
    tests[browser.id] = suite.ele('test',{
      name:'Test1'
    });
    groups[browser.id] = {};
    classNames[browser.id] = {};
  };


  this.onRunStart = function(browsers) {
    suites = Object.create(null);
    tests = Object.create(null);
    xml = builder.create('testng-results');
    xml.ele('reporter-output');

    browsers.forEach(initliazeXmlForBrowser);
  };

  this.onBrowserStart = function(browser) {
    initliazeXmlForBrowser(browser);
  };

  this.onBrowserComplete = function(browser) {
    var suite = suites[browser.id];

    if (!suite) {
      // This browser did not signal `onBrowserStart`. That happens
      // if the browser timed out duging the start phase.
      return;
    }

    var result = browser.lastResult;

    //Getting the passed count
    var passedCount = result.total -result.failed - result.skipped;
    xml.att('passed', passedCount);
    xml.att('failed', result.failed);
    xml.att('skipped',result.skipped);
    xml.att('total', result.total);

    //suite.att('time', (result.netTime || 0) / 1000);

  };

  this.onRunComplete = function() {
    var xmlToOutput = xml;

    pendingFileWritings++;
    helper.mkdirIfNotExists(path.dirname(outputFile), function() {
      fs.writeFile(outputFile, xmlToOutput.end({pretty: true}), function(err) {
        if (err) {
          log.warn('Cannot write TestNG xml\n\t' + err.message);
        } else {
          log.debug('TestNG results written to "%s".', outputFile);
        }

        if (!--pendingFileWritings) {
          fileWritingFinished();
        }
      });
    });

    suites = xml = null;
    allMessages.length = 0;
  };


  this.specSuccess = this.specSkipped = this.specFailure = function(browser, result) {

    var timestamp = (new Date()).toISOString().substr(0, 19) + 'Z';

    var signature = md5(browser.name + result.description);


    var suiteArray = result.suite.toString().split("|")
    var suiteGroups = suiteArray.slice(1);

    var className = ((pkgName ? pkgName + ' ' : '').replace(/\.()/g, '_') + browser.name.replace(/\.()/g, '_') + '.' + suiteArray[0].replace(/\.()/g, '_')).replace(/[\s()]/g, '');

    if(suiteGroups.length !== 0){
      for(var index = 0; index < suiteGroups.length; index++){
        var groupName = suiteGroups[index];
        if(typeof groups[browser.id][groupName] === 'undefined'){
          groups[browser.id][groupName] = group[browser.id].ele('group',{name:groupName});
        }
        groups[browser.id][groupName].ele('method',{
          'class':className,
          name:result.description,
          signature:signature
        });
      }
    }
	
	if(typeof classNames[browser.id][className] === 'undefined'){
      classNames[browser.id][className] = tests[browser.id].ele('class',{
        name:className
      });
    }


    var spec = classNames[browser.id][className].ele('test-method', {
      name: result.description,
      description: result.description,
      'duration-ms': 0,
      'started-at':timestamp,
      'finished-at':timestamp,
      signature:signature
    });



    if (result.skipped) {
      spec.att('status','SKIPPED');
    }

    else if (!result.success) {
      spec.att('status','FAIL')
    }

    else{
      spec.att('status',"PASS")
    }
  };

  // wait for writing all the xml files, before exiting
  this.onExit = function(done) {
    if (pendingFileWritings) {
      fileWritingFinished = done;
    } else {
      done();
    }
  };
};

TestNgReporter.$inject = ['baseReporterDecorator', 'config', 'logger', 'helper', 'formatError'];

// PUBLISH DI MODULE
module.exports = {
  'reporter:testng': ['type', TestNgReporter]
};
