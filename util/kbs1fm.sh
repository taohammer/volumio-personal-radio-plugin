#!/bin/sh
echo '[playlist]'
echo 'File1='`curl -s 'https://cfpwwwapi.kbs.co.kr/api/v1/landing/live/channel_code/24' | jq -r '.channel_item[0].service_url'`
echo 'Title1=KBS Classic FM'
echo 'Length1=-1'
echo 'NumberOfEntries=1'
