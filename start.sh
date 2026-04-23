#!/bin/bash
# dev startup — run from the repo root
echo "Starting Nero Party..."
(cd backend && npm run dev) &
(cd frontend && npm run dev) &
wait
