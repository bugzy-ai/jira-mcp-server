#!/bin/bash
set -e

# Configuration
JIRA_URL="http://localhost:8080"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        log_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
    log_success "Docker is running"
}

# Check if containers are running
containers_running() {
    docker compose -f "$PROJECT_DIR/docker-compose.yml" ps --status running 2>/dev/null | grep -q "jira-mcp-test"
}

# Start containers
start_containers() {
    log_info "Starting Jira and PostgreSQL containers..."
    cd "$PROJECT_DIR"
    docker compose up -d
    log_success "Containers started"
}

# Stop containers
stop_containers() {
    log_info "Stopping containers..."
    cd "$PROJECT_DIR"
    docker compose down
    log_success "Containers stopped"
}

# Wait for Jira to be ready
wait_for_jira() {
    log_info "Waiting for Jira to start (this may take 3-5 minutes on first boot)..."

    local max_attempts=90
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        # Try to reach Jira status endpoint
        local status_code=$(curl -s -o /dev/null -w "%{http_code}" "${JIRA_URL}/status" 2>/dev/null || echo "000")

        if [ "$status_code" = "200" ]; then
            echo ""
            log_success "Jira is responding!"
            return 0
        fi

        printf "."
        sleep 5
        attempt=$((attempt + 1))
    done

    echo ""
    log_error "Timeout waiting for Jira. Check logs with: docker compose logs jira"
    exit 1
}

# Check if Jira setup is complete
check_setup_status() {
    # First try without auth
    local response=$(curl -s "${JIRA_URL}/rest/api/2/serverInfo" 2>/dev/null)

    if echo "$response" | grep -q '"baseUrl"'; then
        return 0  # Setup complete
    fi

    # After setup completes, serverInfo returns empty errors object (requires auth)
    # This is different from setup wizard which would redirect
    if echo "$response" | grep -q '"errorMessages":\[\]'; then
        return 0  # Setup complete, just needs auth
    fi

    # Check if basic auth is disabled message appears (means setup is done)
    response=$(curl -s -u "admin:admin" "${JIRA_URL}/rest/api/2/serverInfo" 2>/dev/null)
    if echo "$response" | grep -q 'Basic Authentication has been disabled'; then
        return 0  # Setup complete, needs PAT
    fi

    if echo "$response" | grep -q '"baseUrl"'; then
        return 0  # Setup complete
    fi

    return 1  # Setup needed
}

# Create test project via API
create_test_project() {
    local auth_type="$1"
    local auth_value="$2"
    local username="$3"

    log_info "Checking for existing TEST project..."

    local auth_header
    if [ "$auth_type" = "pat" ]; then
        auth_header="Authorization: Bearer ${auth_value}"
        local project_check=$(curl -s -H "$auth_header" \
            "${JIRA_URL}/rest/api/2/project/TEST" 2>/dev/null)
    else
        local project_check=$(curl -s -u "${username}:${auth_value}" \
            "${JIRA_URL}/rest/api/2/project/TEST" 2>/dev/null)
    fi

    if echo "$project_check" | grep -q '"key":"TEST"'; then
        log_success "TEST project already exists"
        return 0
    fi

    log_info "Creating TEST project..."

    local response
    if [ "$auth_type" = "pat" ]; then
        response=$(curl -s -X POST \
            -H "$auth_header" \
            -H "Content-Type: application/json" \
            -d '{
                "key": "TEST",
                "name": "Test Project",
                "projectTypeKey": "software",
                "lead": "'"${username}"'",
                "description": "Test project for MCP server development"
            }' \
            "${JIRA_URL}/rest/api/2/project" 2>/dev/null)
    else
        response=$(curl -s -X POST \
            -u "${username}:${auth_value}" \
            -H "Content-Type: application/json" \
            -d '{
                "key": "TEST",
                "name": "Test Project",
                "projectTypeKey": "software",
                "lead": "'"${username}"'",
                "description": "Test project for MCP server development"
            }' \
            "${JIRA_URL}/rest/api/2/project" 2>/dev/null)
    fi

    if echo "$response" | grep -q '"key":"TEST"'; then
        log_success "TEST project created successfully"
    else
        log_warn "Could not create TEST project. Response: ${response}"
        log_info "You may need to create it manually in the Jira UI"
    fi
}

# Generate .env file
generate_env_file() {
    local auth_type="$1"
    local auth_value="$2"
    local username="$3"

    if [ "$auth_type" = "pat" ]; then
        cat > "$PROJECT_DIR/.env" << EOF
# Local Jira Server Configuration
JIRA_BASE_URL=${JIRA_URL}
JIRA_AUTH_TYPE=pat
JIRA_PAT=${auth_value}
EOF
    else
        cat > "$PROJECT_DIR/.env" << EOF
# Local Jira Server Configuration
JIRA_BASE_URL=${JIRA_URL}
JIRA_AUTH_TYPE=basic
JIRA_USERNAME=${username}
JIRA_PASSWORD=${auth_value}
EOF
    fi

    log_success "Generated .env file"
}

# Print setup instructions
print_setup_instructions() {
    echo ""
    echo "=========================================="
    echo -e "${YELLOW}MANUAL SETUP REQUIRED${NC}"
    echo "=========================================="
    echo ""
    echo "Jira is running and connected to PostgreSQL."
    echo ""
    echo "1. Open ${JIRA_URL} in your browser"
    echo ""
    echo "2. Select language and click Continue"
    echo ""
    echo "3. For the license, get a free evaluation license from:"
    echo "   https://my.atlassian.com/license/evaluation"
    echo "   Or use a timebomb license from:"
    echo "   https://developer.atlassian.com/platform/marketplace/timebomb-licenses-for-testing-server-apps/"
    echo ""
    echo "4. Set up your administrator account"
    echo "   Recommended: username=admin, password=admin"
    echo ""
    echo "5. Skip or configure email notifications"
    echo ""
    echo "6. After setup is complete, run this script again:"
    echo "   npm run setup"
    echo ""
    echo "=========================================="
}

# Print success message
print_success() {
    echo ""
    echo "=========================================="
    echo -e "${GREEN}LOCAL JIRA SETUP COMPLETE${NC}"
    echo "=========================================="
    echo ""
    echo "Jira URL: ${JIRA_URL}"
    echo "Project:  TEST"
    echo ""
    echo "Next steps:"
    echo ""
    echo "1. Test with MCP Inspector:"
    echo "   npm run dev"
    echo ""
    echo "2. Test with Claude Code:"
    echo "   Restart Claude Code to load .mcp.json"
    echo "   Then try: 'Search for issues in the TEST project'"
    echo ""
    echo "Useful commands:"
    echo "  docker compose logs -f jira    # View Jira logs"
    echo "  docker compose stop            # Stop all containers"
    echo "  docker compose start           # Start all containers"
    echo "  docker compose down            # Stop and remove containers"
    echo "  docker compose down -v         # Remove containers and data"
    echo ""
    echo "=========================================="
}

# Main
main() {
    echo ""
    log_info "Jira MCP Server - Local Development Setup"
    echo ""

    check_docker

    if ! containers_running; then
        start_containers
    else
        log_info "Containers already running"
    fi

    wait_for_jira

    if check_setup_status; then
        log_success "Jira setup is complete"

        # Prompt for auth type
        echo ""
        echo "Authentication options:"
        echo "  1) Personal Access Token (PAT) - recommended"
        echo "  2) Basic Auth (username/password)"
        echo ""
        read -p "Select authentication type [1]: " auth_choice
        auth_choice=${auth_choice:-1}

        local auth_type
        local auth_value
        local username

        if [ "$auth_choice" = "2" ]; then
            auth_type="basic"
            read -p "Enter Jira admin username [admin]: " username
            username=${username:-admin}
            read -sp "Enter Jira admin password [admin]: " auth_value
            echo ""
            auth_value=${auth_value:-admin}
        else
            auth_type="pat"
            read -p "Enter Jira admin username (for project lead) [admin]: " username
            username=${username:-admin}
            echo ""
            echo "To create a PAT:"
            echo "  1. Go to ${JIRA_URL}"
            echo "  2. Click your profile > Profile"
            echo "  3. Click 'Personal Access Tokens' in sidebar"
            echo "  4. Click 'Create token', give it a name, and copy the token"
            echo ""
            read -sp "Enter your Personal Access Token: " auth_value
            echo ""
        fi

        create_test_project "$auth_type" "$auth_value" "$username"
        generate_env_file "$auth_type" "$auth_value" "$username"
        print_success
    else
        print_setup_instructions
    fi
}

main "$@"
