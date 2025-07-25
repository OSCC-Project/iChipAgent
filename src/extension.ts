import * as vscode from "vscode";
import * as cp from "child_process";
import axios from "axios";
import { report } from "process";

export function activate(context: vscode.ExtensionContext) {
  console.log("Activating extension...");

  // Wait for VS Code to fully load before registering the provider
  setTimeout(() => {
    const chatViewProvider = new ChatViewProvider(context);

    // Register with proper options and error handling
    try {
      const provider = vscode.window.registerWebviewViewProvider(
        "ichipagent.chatView",
        chatViewProvider,
        {
          webviewOptions: {
            retainContextWhenHidden: true,
          },
        }
      );
      context.subscriptions.push(provider);

      // Ensure view container is visible
      vscode.commands.executeCommand("workbench.view.extension.ichipagent");
    } catch (err) {
      console.error("Failed to register WebView provider:", err);
    }
  }, 1000);
}

async function callPythonAPI(api: string, data: any): Promise<any> {
  try {
    const response = await axios.post(`http://localhost:5000/${api}`, data);
    return response.data;
    // return "test show message";
  } catch (error) {
    console.error("API request fail:", error);
    throw error;
  }
}

// WebviewViewProvider implementation for the chat view
class ChatViewProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private editingDocumentUri?: vscode.Uri;
  private currentLLMModel: string = "qwen3:30b-a3b";
  private currentMode: string = "Ask";
  private currentAgent: string = "Search Papers";
  private currentTool: string = "iEDA";
  private reportText: string = "";

  constructor(private readonly context: vscode.ExtensionContext) {}

  private getMediaUri(filename: string): vscode.Uri {
    return this._view!.webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, "resources", filename)
    );
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    // Log to verify resolveWebviewView is called
    console.log("resolveWebviewView called for chatView.");

    this._view = webviewView;

    // Configure the webview
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, "resources"),
      ],
    };

    // Set the HTML content for the webview
    webviewView.webview.html = this.getWebviewContent();

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage((message) => {
      switch (message.command) {
        case "selectModel":
          vscode.window.showInformationMessage(
            `LLM Model selected: ${message.model}`
          );
          this.currentLLMModel = message.model;
          break;
        case "sendMessage":
          if (message.text === "/clear") {
            // Clear the content in the WebView
            webviewView.webview.postMessage({
              command: "clearChat",
            });
          } else if (this.currentMode === "Ask") {
            this.handleChat(webviewView, message.text);
          } else if (this.currentMode === "Agent") {
            this.handleAgentWork(webviewView, message.text);
          }
          break;
        case "selectMode":
          this.currentMode = message.mode;
          vscode.window.showInformationMessage(
            `Mode selected: ${message.mode}`
          );
          // Enable or disable the agent dropdown based on mode
          webviewView.webview.postMessage({
            command: "setAgentEnabled",
            enabled: message.mode === "Agent",
          });
          break;
        case "selectAgent":
          this.currentAgent = message.agent;
          vscode.window.showInformationMessage(
            `Agent selected: ${message.agent}`
          );
          break;
        case "selectTool":
          this.currentTool = message.tool;
          vscode.window.showInformationMessage(
            `Tool selected: ${message.tool}`
          );
          break;

        case "reportText":
          this.reportText = message.text;
          break;
      }
    });
  }

  private handleChat(webviewView: vscode.WebviewView, text: string) {
    // Check if there is a request to obtain the content of the VSCode editor in text
    let contextText = "";
    const fullTextMatch = text.match(
      /(编辑|修改|当前|当前行|行|第(\d+)行|光标所在行|edit|modify|line|active line|cursor line|line (\d+)|全文|全部内容|all text|entire document|full document)/i
    );
    if (fullTextMatch) {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        const documentText = editor.document.getText();
        contextText += `\n【VSCode编辑器全文内容】：\n${documentText}\n`;
      }
    }

    const prompt = contextText ? `${contextText}\n${text}` : text;

    // Show user message immediately with loading state
    webviewView.webview.postMessage({
      command: "showUserMessage",
      message: text,
    });

    const modelSelected = this.currentLLMModel;
    callPythonAPI("chat", {
      model_name: modelSelected,
      prompt: prompt,
    }).then((result) => {
      const response =
        result && result.raw ? result.raw : "No response received";
      webviewView.webview.postMessage({
        command: "updateResponse",
        message: {
          raw: response,
        },
      });

      const codeBlockMatch = response.match(
        /```([a-zA-Z]*)[ \t]*\n([\s\S]*?)```/
      );
      if (codeBlockMatch) {
        const lang = codeBlockMatch[1] || "";
        const code = codeBlockMatch[2];
        const docLang = lang || "plaintext";
        if (this.editingDocumentUri) {
          // If there is a document being edited, directly replace the content
          vscode.workspace
            .openTextDocument(this.editingDocumentUri)
            .then((doc) => {
              const edit = new vscode.WorkspaceEdit();
              const fullRange = new vscode.Range(
                doc.positionAt(0),
                doc.positionAt(doc.getText().length)
              );
              edit.replace(this.editingDocumentUri!, fullRange, code);
              vscode.workspace.applyEdit(edit);
            });
        } else {
          // Otherwise, create a new one and record the uri
          vscode.workspace
            .openTextDocument({ content: code, language: docLang })
            .then((doc) => {
              vscode.window.showTextDocument(doc, { preview: false });
              this.editingDocumentUri = doc.uri;
            });
        }
      }
    });
  }

  private handleSendMessage(webviewView: vscode.WebviewView, text: string) {
    // Call Python script to get response
    const rootScriptPath =
      "/mnt/local_data1/taosimin/illm-agent/src/code-extension/python-script";
    const pythonScriptPath = `${rootScriptPath}/chip_chat_script.py`;
    const modelSelected = "qwq:latest"; // Default model
    const pythonCommand = `/home/taosimin/anaconda3/envs/agent/bin/python ${pythonScriptPath} "${modelSelected}" "${text}"`;

    cp.exec(pythonCommand, (error, stdout, stderr) => {
      const response = stdout.trim();

      const regex = /^=+$\n([\s\S]*)/m;
      const match = stdout.match(regex);

      let response_content = match ? match[1].trim() : null;

      if (response_content) {
        webviewView.webview.postMessage({
          command: "updateChat",
          message: {
            user: text,
            response: response_content,
          },
        });

        return;
      }

      if (stderr) {
        vscode.window.showErrorMessage(`Python script error: ${stderr}`);
        return;
      }

      if (error) {
        vscode.window.showErrorMessage(
          `Error running Python script: ${error.message}`
        );
        return;
      }
    });
  }

  private handleAgentWork(webviewView: vscode.WebviewView, text: string) {
    // Show user message immediately with loading state
    webviewView.webview.postMessage({
      command: "showUserMessage",
      message: text,
    });

    const prompt = text;
    const modelSelected = this.currentLLMModel;

    if (
      this.currentAgent === "Search Papers" ||
      this.currentAgent === "Generate Scripts" ||
      this.currentAgent === "Run Tools" ||
      this.currentAgent === "Analyze Reports"
    ) {
      callPythonAPI("agent", {
        model_name: modelSelected,
        prompt: prompt,
        agent_name: this.currentAgent,
        selected_tool: this.currentTool,
        report_text: this.reportText,
      }).then((result) => {
        const response =
          result && result.raw ? result.raw : "No response received";

        webviewView.webview.postMessage({
          command: "updateResponse",
          message: {
            raw: response,
          },
        });

        const fileLinkRegex = /\/(?:[^'"\s/]+\/)+[^'"\s/]+\.(?:gif|def)/g;
        const fileLinks = response.match(fileLinkRegex);

        if (fileLinks) {
          fileLinks.forEach((filePath: string) => {
            try {
              const fileUri = vscode.Uri.parse(filePath);
              vscode.commands.executeCommand("vscode.open", fileUri);
            } catch (err) {
              console.error(`Failed to open file: ${filePath}`, err);
            }
          });
        }
      });
    } else {
      vscode.window.showInformationMessage(
        `Agent selected: ${this.currentAgent} not supported yet.`
      );
    }
  }

  private getWebviewContent(): string {
    const userIconPath = this.getMediaUri("question.svg");
    const botIconPath = this.getMediaUri("iEDA_64x64.svg");
    const highlightJsUri = this.getMediaUri("js/highlight.min.js");
    const highlightTclUri = this.getMediaUri("js/tcl_min.js");
    const markedJsUri = this.getMediaUri("js/marked.min.js");
	const highlightCssUri = this.getMediaUri("github-dark.min.css");

    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<title>Chat with Models</title>
				<link rel="stylesheet" href="${highlightCssUri}">
				<script src="${highlightJsUri}"></script>
				<script src="${highlightTclUri}"></script>
				<script src="${markedJsUri}"></script>
				<script>
					// Initialize highlight.js
					const hljs = window.hljs;
					// Register TCL language
					if (hljs && window.hljsDefineTcl) {
						hljs.registerLanguage('tcl', window.hljsDefineTcl);
					}
				</script>
				<style>
					body {
						font-family: Arial, sans-serif;
						margin: 0;
						padding: 0;
						background-color: var(--vscode-editor-background);
						color: var(--vscode-editor-foreground);
						height: 100vh;
					}
					#container { 
						padding: 10px; 
						height: 100%;
						display: flex;
						flex-direction: column;
						box-sizing: border-box;
					}
					.dropdown-container {
						margin-bottom: 10px;
						display: flex;
						justify-content: space-between;
						align-items: center;
					}
					#dropdown-model { 
						background-color: var(--vscode-input-background);
						color: var(--vscode-input-foreground);
						border: 1px solid var(--vscode-input-border);
						padding: 4px;
						width: 140px;
						height: 28px;
						box-sizing: border-box;
					}
					#dropdown-agent {
						background-color: var(--vscode-input-background);
						color: var(--vscode-input-foreground);
						border: 1px solid var(--vscode-input-border);
						padding: 4px;
						width: 150px;
						height: 28px;
						box-sizing: border-box;
						font-size: 12px;
					}
					#input { 
						display: flex;
						flex-direction: column;
						min-height: 60px;
						gap: 2px;
					}
					#input-top {
						display: flex;
						gap: 5px;
					}
					#input textarea { 
						flex: 1;
						background-color: var(--vscode-input-background);
						color: var(--vscode-input-foreground);
						border: 1px solid var(--vscode-input-border);
						padding: 4px;
						resize: none;
						width: 100%;
					}
					#input-bottom {
						display: flex;
						justify-content: flex-start;
						gap: 5px;
						margin-top: 2px;
					}
					#dropdown-mode {
						background-color: var(--vscode-input-background);
						color: var(--vscode-input-foreground);
						border: 1px solid var(--vscode-input-border);
						padding: 2px;
						width: 60px;
						height: 14px;
						box-sizing: border-box;
						font-size: 8px;
						margin-left: 2px;
					}
					#chat { 
						border: 1px solid var(--vscode-editorWidget-border); 
						padding: 10px; 
						flex-grow: 1;
						overflow-y: auto;
						margin-bottom: 10px;
					}
					#input button { 
						margin-left: 5px;
						background-color: var(--vscode-button-background);
						color: var(--vscode-button-foreground);
						border: none;
						padding: 4px 8px;
					}
					#input button:hover {
						background-color: var(--vscode-button-hoverBackground);
					}
					.message {
						display: flex;
						align-items: flex-start;
						margin-bottom: 10px;
					}
					.avatar {
						width: 32px;
						height: 32px;
						border-radius: 50%;
						background-size: cover;
						background-position: center;
						margin-right: 5px;
					}
					.user .avatar {
						background-image: url('${userIconPath}');
					}
					.response .avatar {
						background-image: url('${botIconPath}');
					}
					.message-content {
						flex-grow: 1;
						background-color: var(--vscode-input-background);
						color: var(--vscode-input-foreground);
						border-radius: 5px;
						padding: 8px;
						max-width: 80%;
					}
					.message-content pre {
						background: var(--vscode-editor-background);
						padding: 12px;
						border-radius: 6px;
						margin: 8px 0;
						overflow-x: auto;
					}
					.message-content code {
						font-family: var(--vscode-editor-font-family);
						font-size: inherit;
						line-height: 1.4;
					}
					/* Code block colors */
					.hljs-keyword { color: #ff79c6; }
					.hljs-string { color: #f1fa8c; }
					.hljs-comment { color: #6272a4; }
					.hljs-function { color: #50fa7b; }
					.hljs-number { color: #bd93f9; }
					.hljs-operator { color: #ff79c6; }
					.hljs-class { color: #8be9fd; }
					.message-content p {
						margin: 8px 0;
					}
					.message-content ul, .message-content ol {
						margin: 8px 0;
						padding-left: 20px;
					}
					.divider {
						height: 1px;
						background-color: var(--vscode-editorWidget-border);
						margin: 10px 0;
					 }
					.message-group {
						margin-bottom: 20px;
					}
					.qa-divider {
						height: 2px;
						background-color: var(--vscode-editorWidget-border);
						margin: 20px 0;
						opacity: 0.5;
					}
					.loading {
						display: flex;
						align-items: center;
						gap: 8px;
					}
					.loading:after {
						content: '...';
						animation: loading 1s steps(4, end) infinite;
					}
					@keyframes loading {
						to { content: '.....';}
					}
				</style>
			</head>
			<body>
				<div id="container">
					<div class="dropdown-container">
						<select id="dropdown-model">
							<option value="qwen3:30b-a3b">qwen3:30b-a3b</option>
							<option value="deepseek-r1:70b">deepseek-r1:70b</option>
                            <option value="qwq:latest">qwq:latest</option>
							<option value="llama3.1:latest">llama3.1:latest</option>
						</select>
						<select id="dropdown-agent" disabled style="background-color: var(--vscode-editorWidget-border);">
							<option value="Search Papers">Search Papers</option>
							<option value="Generate Scripts">Generate Scripts</option>
							<option value="Run Tools">Run Tools</option>
							<option value="Analyze Reports">Analyze Reports</option>
						</select>
						<select id="dropdown-tool" style="display: none; background-color: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); padding: 4px; width: 150px; height: 28px; box-sizing: border-box; font-size: 12px;">
							<option value="iEDA">iEDA</option>
							<option value="Reserved">Reserved</option>
						</select>
					</div>
					<div id="chat"></div>
					<div id="input">
						<div id="report-input" style="display: none; margin-bottom: 10px;">
							<label for="report-text">Please enter the report to be analyzed:</label>
							<textarea id="report-text" rows="3" placeholder="Enter the content or path of the report..."></textarea>
						</div>
						<div id="input-top">
							<textarea id="message" rows="3"></textarea>
							<button id="send">Send</button>
						</div>
						<div id="input-bottom">
							<select id="dropdown-mode">
								<option value="Ask">Ask</option>
								<option value="Edit">Edit</option>
								<option value="Agent">Agent</option>
							</select>
						</div>
					</div>
				</div>
				<script>
					const vscode = acquireVsCodeApi();

					// Handle both dropdowns change
					document.getElementById('dropdown-model').addEventListener('change', (event) => {
						vscode.postMessage({
							command: 'selectModel',
							model: event.target.value
						});
					});

					document.getElementById('dropdown-agent').addEventListener('change', (event) => {
						const selectedAgent = event.target.value;
						const toolDropdown = document.getElementById('dropdown-tool');
						const reportInput = document.getElementById('report-input');

						if (selectedAgent === 'Run Tools') {
							toolDropdown.style.display = 'inline-block';
						} else {
							toolDropdown.style.display = 'none';
						}

						// 新增: 控制报告输入框的显示
						if (selectedAgent === 'Analyze Reports') {
							reportInput.style.display = 'block';
						} else {
							reportInput.style.display = 'none';
						}

						vscode.postMessage({
							command: 'selectAgent',
							agent: selectedAgent
						});
					});

					// 新增: 添加对工具下拉框的事件监听
					document.getElementById('dropdown-tool').addEventListener('change', (event) => {
						vscode.postMessage({
							command: 'selectTool',
							tool: event.target.value
						});
					});

					document.getElementById('dropdown-mode').addEventListener('change', (event) => {
						vscode.postMessage({
							command: 'selectMode',
							mode: event.target.value
						});
					});

					// Handle send button click
					document.getElementById('send').addEventListener('click', sendMessage);

					// Handle Ctrl+Enter shortcut
					document.getElementById('message').addEventListener('keydown', (event) => {
						if (event.key === 'Enter' && event.ctrlKey) {
							event.preventDefault();
							sendMessage();
						}
					});

					function sendMessage() {
						const message = document.getElementById('message').value;
						const reportText = document.getElementById('report-text').value;

						if (message.trim() && reportText.trim()) {
							vscode.postMessage({
								command: 'reportText',
								text: reportText
							});							
						}

                        if (message.trim()) {
							vscode.postMessage({
								command: 'sendMessage',
								text: message
							});
							document.getElementById('message').value = '';
						}
					}
					window.addEventListener('message', (event) => {
					const message = event.data;
					switch(message.command) {
						case 'setAgentEnabled':
						const workDropdown = document.getElementById('dropdown-agent');
						if (workDropdown) {
							workDropdown.disabled = !message.enabled;
							workDropdown.style.backgroundColor = message.enabled
							? ''
							: 'var(--vscode-editorWidget-border)';
						}
						break;
					}
					});

					// Handle update chat message
					window.addEventListener('message', (event) => {
						const message = event.data;
						switch(message.command) {
							case 'showUserMessage':
								showUserMessage(message.message);
								break;
							case 'updateResponse':
								updateResponse(message.message);
								break;
							case 'clearChat':		
								const chatDiv = document.getElementById('chat');
								chatDiv.innerHTML = '';
								break;
						}
					});

					function showUserMessage(userMessage) {
						const chatDiv = document.getElementById('chat');
						
						const messageGroup = document.createElement('div');
						messageGroup.className = 'message-group';
						
						const userDiv = document.createElement('div');
						userDiv.className = 'message user';
						const userAvatar = document.createElement('div');
						userAvatar.className = 'avatar';
						const userContent = document.createElement('div');
						userContent.className = 'message-content';
						userContent.textContent = userMessage;
						userDiv.appendChild(userAvatar);
						userDiv.appendChild(userContent);

						const divider = document.createElement('div');
						divider.className = 'divider';

						const loadingDiv = document.createElement('div');
						loadingDiv.className = 'message response';
						loadingDiv.id = 'loading-response';
						const loadingAvatar = document.createElement('div');
						loadingAvatar.className = 'avatar';
						const loadingContent = document.createElement('div');
						loadingContent.className = 'message-content loading';
						loadingContent.textContent = 'Thinking';
						loadingDiv.appendChild(loadingAvatar);
						loadingDiv.appendChild(loadingContent);

						messageGroup.appendChild(userDiv);
						messageGroup.appendChild(divider);
						messageGroup.appendChild(loadingDiv);

						if (chatDiv.children.length > 0) {
							const qaDivider = document.createElement('div');
							qaDivider.className = 'qa-divider';
							chatDiv.appendChild(qaDivider);
						}

						chatDiv.appendChild(messageGroup);
						chatDiv.scrollTop = chatDiv.scrollHeight;
					}

					function updateResponse(response) {
						const chatDiv = document.getElementById('chat');
						const loadingDiv = document.getElementById('loading-response');
						
						const responseDiv = document.createElement('div');
						responseDiv.className = 'message response';
						const responseAvatar = document.createElement('div');
						responseAvatar.className = 'avatar';
						const responseContent = document.createElement('div');
						responseContent.className = 'message-content';

						// Configure marked with syntax highlighting
						marked.setOptions({
							highlight: function(code, lang) {
								if (lang && hljs.getLanguage(lang)) {
									try {
										return hljs.highlightElement(code, {
											language: lang,
											ignoreIllegals: true
										}).value;
									} catch (err) {
										console.log('Syntax highlighting failed for ' + lang + ':', err);
									}
								}
								return code;
							}
						});

						// Render markdown
						responseContent.innerHTML = marked.parse(response.raw);

						// responseContent.textContent = response.raw;
						
						responseDiv.appendChild(responseAvatar);
						responseDiv.appendChild(responseContent);

						loadingDiv.replaceWith(responseDiv);
						chatDiv.scrollTop = chatDiv.scrollHeight;
					}
				</script>
			</body>
			</html>
		`;
  }
}

// This method is called when your extension is deactivated
export function deactivate() {}
