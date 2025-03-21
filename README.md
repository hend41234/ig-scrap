# to get link post, run the ptr.js / ptr_extra.js
    
* with account
```bash
node ptr_extra.js -u username -q 10 -e your_username_or_email_instagram -p your_password_instagram --sv output_name -t json
```
or

* without account
```bash
node ptr.js -u username -s yyyy-mm-dd --sv output -t json
```

for detail run :
```bash
node ptr.js --help
```
if it has been run before, and saves the cookie. u dont need -e and -p

# to get link video from link post, you can run :

```bash
go run main.go -list path/to/list.json -save name_file.json
```



