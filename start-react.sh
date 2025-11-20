#!/bin/bash
# Wrapper script to keep React dev server running
cd "$(dirname "$0")/frontend"
exec yarn start

