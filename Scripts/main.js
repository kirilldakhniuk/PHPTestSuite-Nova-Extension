var treeView = null;
var testRunner = null;
var isPest = true;


exports.activate = function() {
    treeView = new TreeView("phptestsuite", {
        dataProvider: new TestDataProvider()
    });
    
    treeView.onDidChangeSelection((selection) => {
      //
    });
    
    treeView.onDidExpandElement((element) => {
      nova.workspace.config.set(`${element.name}-expanded`, true);
    });
    
    treeView.onDidCollapseElement((element) => {
        nova.workspace.config.remove(`${element.name}-expanded`);
    });
    
    treeView.onDidChangeVisibility(() => {
        // console.log("Visibility Changed");
    });
    
    testRunner = getTestRunner();
}

exports.deactivate = function() {
    // Clean up state before the extension is deactivated
}

nova.commands.register("phptestsuite.runFile", (editor) => {
  const parts = editor.activeTextEditor.document.path.split('/');
  const testFilename = parts[parts.length - 1].replace('.php', '');
  
  nova.workspace.config.set('latestTest', testFilename);
  
  runTestProcess(testFilename);
});

nova.commands.register("phptestsuite.runAll", (editor) => {
  runTestProcess();
});

nova.commands.register("phptestsuite.runNearest", (editor) => {  
  let start = editor.activeTextEditor.selectedRange.start;
  let end = editor.activeTextEditor.selectedRange.end;
  
  let method;
  
  while (start > 0) {
    let lineText = editor.activeTextEditor.document.getTextInRange(
      editor.activeTextEditor.getLineRangeForRange(new Range(start, end))
    );
    
    method = getTestMethod(lineText);
    
    if (method) {
      break;
    }
    
    start = start - 1;
    end = end - 1;
  }
  
  nova.workspace.config.set("latestTest", method);
  
  runTestProcess(method);
});

nova.commands.register("phptestsuite.runLatest", (editor) => {
  const latest = nova.workspace.config.get("latestTest");
  
  if (latest) {
    runTestProcess(latest);
  } else {
    nova.workspace.showInformativeMessage("You need to run a test first.");
  }
});

nova.commands.register("phptestsuite.doubleClick", () => {    
    let selection = treeView.selection;
    
    runTestProcess(selection.map((e) => e.name));
});

function getWorkingDirPath() {
  let workingDir =
    nova.workspace.config.get(
      "tests",
      "string"
    ) || nova.workspace.path;
  if (! workingDir) {
    return null;
  }
  if (! nova.path.isAbsolute(workingDir)) {
    if (! nova.workspace.path) {
      return null;
    }
    workingDir = nova.path.join(nova.workspace.path, workingDir);
  }
  return nova.path.normalize(workingDir);
}

function getTestRunner() {
  if (! nova.fs.stat(nova.path.join(nova.workspace.path, "composer.json"))) {
    nova.workspace.showErrorMessage('Project must contain composer.json file in order to run tests.');
    return;
  }
  
  const fileContent = nova.fs.open(nova.path.join(nova.workspace.path, "composer.json"));
  
  if (! fileContent.read().includes('"pestphp/pest"')) {
    isPest = false;
    
    return "vendor/bin/phpunit";
  }
  
  return "vendor/bin/pest";
}

function getTestMethod(text) {
  const matchPest = text.trim().match(/^\s*(?:it|test)\(([^,)]+)/m);
  
  const matchUnit = text.trim().match(/^\s*(?:public|private|protected)?\s*function\s*(\w+)\s*\(.*$/);
  
  if (matchPest) {
    return matchPest[1].replace(/["']/g, "");
  } else if (matchUnit) {
    return matchUnit[1].replace(/["']/g, "");
  }
  
  return null;
}

function runTestProcess(test = null) {
  const args = test ? ["--filter", '"' + test + '"'] : [];
  
  const process = new Process(nova.path.join(nova.workspace.path, testRunner), {
      args,
      env: {
          CI: "true"
      },
      cwd: getWorkingDirPath(),
      stdio: ["ignore", "pipe", "pipe"],
  });
  
  let output = "\n\n";
  
  try {
      process.onStdout(function(line) {
        output += line;
      });
      
      process.start();
  } catch (e) {
      console.log(e);
  }
  
  process.onDidExit(() => {
    if (output.includes('FAIL')) {
      nova.workspace.config.set(test, "FAIL");
    }
    
    if (output.includes('PASS')) {
      nova.workspace.config.set(test, "PASS");
    }
    
    treeView.reload();
    
    nova.workspace.showInformativeMessage(output.substr(1, 2000));
  });
}

class TestDataProvider {
    constructor() {
        this.rootItems = [];
        
        this.findTests(nova.path.join(getWorkingDirPath(), "tests"));
    }
    
    getChildren(element) {
        if (! element) {
            return this.rootItems;
        }
        else {
            return element.children;
        }
    }
    
    getParent(element) {
        return element.parent;
    }
    
    getTreeItem(element) {
        let item = new TreeItem(element.name);
        
        if (element.children.length > 0) {
            item.collapsibleState = nova.workspace.config.get(`${element.name}-expanded`) ?
              TreeItemCollapsibleState.Expanded :
              TreeItemCollapsibleState.Collapsed;
            item.image = isPest ? "../Images/sidebar-pest-icon/sidebar-pest-icon.png" : "../Images/sidebar-phpunit-icon/sidebar-phpunit-icon.png";
            item.contextValue = "test class";
        } else {
            if (nova.workspace.config.get(element.name) === "FAIL") {
              item.image = "../Images/sidebar-warning-icon/sidebar-warning-icon.png";
            }
            
            if (nova.workspace.config.get(element.name) === "PASS") {
              item.image = "../Images/sidebar-success-icon/sidebar-success-icon.png";
            }
            
            item.command = "phptestsuite.doubleClick";
            item.contextValue = "test method";
        }
        
        return item;
    }
    
    findTests(path) {
      const tests = nova.fs.listdir(path);
      
      tests.forEach((test) => {
        const element = new TestItem(test);
            
        if (nova.fs.stat(nova.path.join(path, test)).isDirectory()) {
          return this.findTests(nova.path.join(path, test));
        }
        
        if (! element.name.toString().endsWith("Test.php")) {
          return;
        }
        
        const fileContent = nova.fs.open(nova.path.join(path, test));
        
        let hasTests = false;
        
        fileContent.readlines().forEach((line) => {
          const method = getTestMethod(line);
          
          if (method) {
            element.addChild(new TestItem(method));
            hasTests = true;
          }
       });
       
        if (hasTests) {
          this.rootItems.push(element);
        }
      });
    }
}

class TestItem {
    constructor(name) {
        this.name = name;
        this.children = [];
        this.parent = null;
    }
    
    addChild(element) {
        element.parent = this;
        this.children.push(element);
    }
}

