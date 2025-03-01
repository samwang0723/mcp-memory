#!/bin/bash

# Colors for better readability
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Redis CLI Helper for RedisGraph${NC}"
echo -e "${BLUE}This script helps you connect to Redis and run common RedisGraph commands${NC}"

# Connect to Redis container
echo -e "\n${YELLOW}Connecting to Redis container...${NC}"
docker exec -it mcp-memory-redis-1 bash -c '
echo -e "\n\033[1;33mRedis CLI Helper - Common Commands:\033[0m"
echo -e "\033[0;34m1. List all graphs:\033[0m"
echo "   GRAPH.LIST"
echo -e "\n\033[0;34m2. Get node count:\033[0m"
echo "   GRAPH.QUERY memory \"MATCH (n) RETURN count(n)\""
echo -e "\n\033[0;34m3. View Finance memories:\033[0m"
echo "   GRAPH.QUERY memory \"MATCH (n:Finance) RETURN n.id, n.title, n.content\""
echo -e "\n\033[0;34m4. Search for debit card topup:\033[0m"
echo "   GRAPH.QUERY memory \"MATCH (n) WHERE n.content CONTAINS \\\"debit card topup\\\" RETURN n.id, n.type, n.content\""
echo -e "\n\033[0;34m5. View relationships:\033[0m"
echo "   GRAPH.QUERY memory \"MATCH (a)-[r]->(b) RETURN a.id, type(r), b.id\""
echo -e "\n\033[0;34m6. View node properties:\033[0m"
echo "   GRAPH.QUERY memory \"MATCH (n) WHERE n.id = \\\"96fbfe00-10e1-4946-901a-592551ea351b\\\" RETURN n\""
echo -e "\n\033[0;34m7. Exit redis-cli:\033[0m"
echo "   exit"
echo -e "\n\033[1;33mStarting redis-cli...\033[0m"
redis-cli
' 