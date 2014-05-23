#!/bin/sh

clear;clear;

java -jar ../bootstrap/bootstrap.jar \
	-war ./ \
	-p 8080 \
	--tomcat
