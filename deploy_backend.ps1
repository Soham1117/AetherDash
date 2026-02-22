
# Configuration - Update these if needed
$EC2_HOST = "ec2-44-201-124-110.compute-1.amazonaws.com"
$EC2_USER = "ubuntu"
$KEY_PATH = "$env:USERPROFILE\.ssh\dashboard.pem"
# Path where we want the repo to be clone/located
$REMOTE_BASE_DIR = "/home/ubuntu"
$REPO_NAME = "finance_app"
$REMOTE_REPO_DIR = "$REMOTE_BASE_DIR/$REPO_NAME"
$GIT_REPO_URL = "https://github.com/Soham1117/AetherDash.git"
$LOCAL_BACKEND_DIR = "backend"

Write-Host "🚀 Starting Deployment (Git Workflow) to $EC2_HOST..." -ForegroundColor Cyan

# 1. Setup Remote Repository (Clone/Pull) & Venv
Write-Host "🔧 Setting up remote codebase..." -ForegroundColor Yellow

# Use a Here-String for complex commands, but we'll join it carefully to avoid CRLF
$setup_commands_list = @(
    "cd $REMOTE_BASE_DIR;",
    # Logic: If dir exists but no .git, it's a legacy artifact -> BACKUP & CLONE
    # "if [ -d '$REPO_NAME' ] && [ ! -d '$REPO_NAME/.git' ]; then",
    # "  echo '⚠️  Directory exists but is NOT a git repo. Backing up...';",
    # "  mv $REPO_NAME ${REPO_NAME}_backup_`date +%s`;",
    # "fi",
    # Logic: If dir doesn't exist (or was just moved), CLONE
    # "if [ ! -d '$REPO_NAME' ]; then",
    # "  echo '⬇️  Repository not found/moved. Cloning...';",
    # "  git clone $GIT_REPO_URL $REPO_NAME;",
    # "else",
    # Logic: If it exists (and is a git repo per check above), PULL
    # "  echo '⬇️  Repository exists. Pulling latest code...';",
    # "  cd $REPO_NAME && git pull origin main;",
    # "fi",
    "if [ -d 'finance_app' ]; then",
    "rm -rf finance_app;",
    "fi;",
    "rm -rf AetherDash;",
    "git clone $GIT_REPO_URL;",
    "mv AetherDash/backend finance_app;",
    # Ensure venv exists
    "cd $REMOTE_REPO_DIR;",
    "if [ ! -d 'venv' ]; then",
    "  echo '🐍 Creating virtual environment...';",
    "  python3 -m venv venv;",
    "fi"
)
# Join with " && " or "; " where appropriate. 
# Bash if/fi blocks need semicolons or newlines. We'll use semicolons and join with spaces.
# But "&&" is safer for stopping on error. 
# Let's simple create a long string with semicolons for the logic blocks.
$setup_commands = $setup_commands_list -join " "

try {
    ssh -i $KEY_PATH "${EC2_USER}@${EC2_HOST}" $setup_commands
    if ($LASTEXITCODE -ne 0) { throw "Setup failed with exit code $LASTEXITCODE" }
    Write-Host "✅ Codebase & Venv ready." -ForegroundColor Green
}
catch {
    Write-Error "Error setting up codebase: $_"
    exit 1
}

# 2. Upload .env file
Write-Host "cx📤 Uploading .env to $REMOTE_REPO_DIR/backend/..." -ForegroundColor Yellow
try {
    # Upload .env
    scp -i $KEY_PATH "$LOCAL_BACKEND_DIR\.env" "${EC2_USER}@${EC2_HOST}:${REMOTE_REPO_DIR}/"
    scp -i $KEY_PATH "$LOCAL_BACKEND_DIR\requirements.txt" "${EC2_USER}@${EC2_HOST}:${REMOTE_REPO_DIR}/"
    if ($LASTEXITCODE -ne 0) { throw "SCP failed with exit code $LASTEXITCODE" }
    Write-Host "✅ .env uploaded." -ForegroundColor Green
}
catch {
    Write-Error "Error uploading .env: $_"
    exit 1
}

# 3. Finalize Deployment (Install reqs, Migrate, Restart)
Write-Host "🚢 Finalizing deployment..." -ForegroundColor Yellow

$deploy_commands_list = @(
    "cd $REMOTE_REPO_DIR",
    "echo '🐍 Updating dependencies...'",
    "source venv/bin/activate",
    "pip install -r requirements.txt",
    "echo '🗄️ Running migrations...'",
    "python manage.py migrate",
    "python manage.py collectstatic --noinput",
    "echo 'Aq🔄 Restarting Gunicorn...'",
    " sudo systemctl restart gunicorn-finance_app.service",
    "echo '✅ Deployment Success!'"
)
$deploy_commands = $deploy_commands_list -join " && "

try {
    ssh -i $KEY_PATH "${EC2_USER}@${EC2_HOST}" $deploy_commands
    if ($LASTEXITCODE -ne 0) { throw "Deployment commands failed with exit code $LASTEXITCODE" }
}
catch {
    Write-Error "Error finalizing deployment: $_"
    exit 1
}

Write-Host "✨ Deployment Finished Successfully!" -ForegroundColor Cyan
