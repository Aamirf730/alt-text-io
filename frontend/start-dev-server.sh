#!/bin/bash
# Wrapper script to keep yarn start running
cd "$(dirname "$0")"
exec yarn start
