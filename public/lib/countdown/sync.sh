#!/bin/bash

clear;clear;

#	s3://countdownjs/
#	cf://dp7mg8c9zt1um.cloudfront.net

# exclude '.DS_Store' and hg files

s3cmd sync \
	--reduced-redundancy \
	--cf-invalidate \
	--acl-public \
	--recursive \
	--exclude '.DS_Store' \
	--exclude '.hg/*' \
	--exclude '.hgignore' \
	--exclude '.hgtags' \
	--exclude '*.sh' \
	--exclude 'tomcat/*' \
	--exclude 'build.*' \
	--exclude 'favicon.ai' \
	--exclude 'package.json' \
	--exclude 'countdown.js' \
	--exclude 'lib/closure/*' \
	--exclude 'lib/jslint/*' \
	--exclude 'lib/rhino/*' \
	--exclude 'test/lint.js' \
	'./' \
	s3://countdownjs/

s3cmd cfinvalinfo cf://E162AG4E8H50A7
