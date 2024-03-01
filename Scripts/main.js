var treeView = null;
var testRunner = null;


exports.activate = function() {
    // Do work when the extension is activated
    const compositeDisposable = new CompositeDisposable();
    
    // Create the TreeView
    treeView = new TreeView("phptestsuite", {
        dataProvider: new TestDataProvider()
    });
    
    treeView.onDidChangeSelection((selection) => {
        // console.log("New selection: " + selection.map((e) => e.name));
    });
    
    treeView.onDidExpandElement((element) => {
        // console.log("Expanded: " + element.name);
    });
    
    treeView.onDidCollapseElement((element) => {
        // console.log("Collapsed: " + element.name);
    });
    
    treeView.onDidChangeVisibility(() => {
        // console.log("Visibility Changed");
    });
    
    // TreeView implements the Disposable interface
    nova.subscriptions.add(treeView);
    
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
    let lineText = editor.activeTextEditor.document.getTextInRange(editor.activeTextEditor.getLineRangeForRange(new Range(start, end)));
    
    method = getTestMethod(lineText);
    
    if (method) {
      break;
    }
    
    start = start - 1;
    end = end - 1;
  }
  
  nova.workspace.config.set('latestTest', method);
  
  runTestProcess(method);
});

nova.commands.register("phptestsuite.runLatest", (editor) => {
  const latest = nova.workspace.config.get('latestTest');
  
  if (latest) {
    runTestProcess(latest);
  } else {
    nova.workspace.showInformativeMessage('You need to run test first.');
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
  if (!workingDir) {
    return null;
  }
  if (!nova.path.isAbsolute(workingDir)) {
    if (!nova.workspace.path) {
      return null;
    }
    workingDir = nova.path.join(nova.workspace.path, workingDir);
  }
  return nova.path.normalize(workingDir);
}

function getTestRunner() {
  if (! nova.fs.stat(nova.path.join(nova.workspace.path, 'composer.json'))) {
    nova.workspace.showErrorMessage('Project must contain composer.json file in order to run tests.');
    return;
  }
  
  const fileContent = nova.fs.open(nova.path.join(nova.workspace.path, 'composer.json'));
  
  return fileContent.read().includes('"pestphp/pest"') ? "vendor/bin/pest" : "vendor/bin/phpunit";
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
  
  let errOutput = "\n\n";
  
  try {
      process.onStdout(function(line) {
        errOutput += line;
      });
      
      process.start();
  } catch (e) {
      console.log(e);
  }
  
  process.onDidExit(() => {
    nova.workspace.showActionPanel(errOutput);
  });
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

class TestDataProvider {
    constructor() {
        this.rootItems = [];
        
        this.findTests(nova.path.join(getWorkingDirPath(), "tests"));
    }
    
    getChildren(element) {
        // Requests the children of an element
        if (!element) {
            return this.rootItems;
        }
        else {
            return element.children;
        }
    }
    
    getParent(element) {
        // Requests the parent of an element, for use with the reveal() method
        return element.parent;
    }
    
    getTreeItem(element) {
        let item = new TreeItem(element.name);
        
        if (element.children.length > 0) {
            item.collapsibleState = TreeItemCollapsibleState.Collapsed;
            item.image = "__filetype.php";
            item.contextValue = "test class";
        } else {
            item.command = "phptestsuite.doubleClick";
            item.contextValue = "test method";
        }
        
        return item;
    }
    
    findTests(path) {
      let tests = nova.fs.listdir(path);
      
      tests.forEach((test) => {
        let element = new TestItem(test);
            
        if (nova.fs.stat(nova.path.join(path, test)).isDirectory()) {
          return this.findTests(nova.path.join(path, test));
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

