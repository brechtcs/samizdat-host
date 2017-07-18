#!/bin/bash

curl http://localhost:6000 | vipe | curl -XPOST --data-binary @- http://localhost:6000
