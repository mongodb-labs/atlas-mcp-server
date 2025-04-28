#!/bin/sh

# Start MongoDB
mongod --fork --logpath /var/log/mongodb.log --dbpath /data/db

# Execute the provided command or default to the application
exec "$@"
