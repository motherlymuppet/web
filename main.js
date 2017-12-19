const express = require('express')
const fs = require('fs');
const app = express()
const request = require('requestify')
const bodyParser = require('body-parser')
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
  extended: true
}));
app.use(express.static('public'))
app.enable('trust proxy')

 
const BASE = '/events2017/'

function Venue (venue_id, name, postcode, town, url, icon) {
	this.venue_id = venue_id;
	this.name = name;
	this.postcode = postcode;
	this.town = town;
	this.url = url;
	this.icon = icon;
}

function Event (event_id, title, blurb, date, url, venue) {
	this.event_id = event_id;
	this.title = title;
	this.blurb = blurb;
	this.date = date;
	this.url = url;
	this.venue = venue;
}


//  _____                  _       _                         
// |  __ \                (_)     | |                         
// | |__) |___  _ __  ___  _  ___ | |_  ___  _ __    ___  ___ 
// |  ___// _ \| '__|/ __|| |/ __|| __|/ _ \| '_ \  / __|/ _ \
// | |   |  __/| |   \__ \| |\__ \| |_|  __/| | | || (__|  __/
// |_|    \___||_|   |___/|_||___/ \__|\___||_| |_| \___|\___|

function save(filename, text){
	fs.writeFile(filename, text, function(err){
		console.log(err)
	})
}

function load(filename, callback){
	fs.readFile(filename, function(err, data){
		if(err){
			console.log(err)
		}
		else{
			callback(JSON.parse(data))
		}
	})
}

function withEvents(callback){
	load('events.json', callback)
}

function saveEvents(events){
	save('events.json', JSON.stringify(events))
}

function withVenues(callback){
	load('venues.json', callback)
}

function saveVenues(venues){
	save('venues.json', JSON.stringify(venues))
}


//  _____                                 _        
// |  __ \                               | |       
// | |__) | ___   __ _  _   _   ___  ___ | |_  ___ 
// |  _  / / _ \ / _` || | | | / _ \/ __|| __|/ __|
// | | \ \|  __/| (_| || |_| ||  __/\__ \| |_ \__ \
// |_|  \_\\___| \__, | \__,_| \___||___/ \__||___/
//                  | |                            
//                  |_|                            

app.get('/', function(req, resp){ //Redirect to /events2017/
	console.log('GET /')
	resp.redirect(BASE)
})

app.get(BASE + 'venues', function(req, resp){
	console.log('GET venues')
	withVenues(function(venues){
		const json = {}
		json.venues = venues
		resp.setHeader('Content-Type', 'application/json')
		resp.status(200)
		resp.json(json)
	})
})

app.get(BASE + 'events/search', function(req, resp) {
	console.log('GET events/search')
	const search = req.query.search
	const date = req.query.date
	
	withEvents(function(events){
		const json = []
		events.forEach(function(event) { //Search for events that fit the search criteria
			if(!search || event.title.toLowerCase().includes(search.toLowerCase())){
				if(date){
					const eventDate = new Date(Date.parse(event.date)).setHours(0,0,0,0)
					const queryDate = new Date(Date.parse(date)).setHours(0,0,0,0)
					if(eventDate == queryDate){
						json.push(event)
					}
				}
				else{
					json.push(event)
				}
			}
		})
	
		if(!search && !date){ //If no search or date parameters, also get from external source
			console.log('GET request sent to eventful')
			request.get('http://api.eventful.com/json/events/search?app_key=xtMtCvcT3wV44JWN&keywords=concertina&location=United+Kingdom').then(function(response){
				console.log('Response Received')
				const extEvents = JSON.parse(response.body).events.event
				extEvents.forEach(function(e){
					const id = e.id
					const title = e.title
					const blurb = e.description
					const date = e.start_time
					const url = e.url
					const venue_id = e.venue_id
					const venue_name = e.venue_name
					const venue_postcode = e.postal_code
					const venue_town = e.region_abbr
					const venue_url = e.venue_url
					const venue = new Venue(venue_id, venue_name, venue_postcode, venue_town, venue_url, '')
					const event = new Event(id, title, blurb, date, url, venue)
					json.push(event)
				})
				resp.setHeader('Content-Type', 'application/json')
				resp.status(200)
				resp.json(json)
			})
		}
		else{
			resp.setHeader('Content-Type', 'application/json')
			resp.status(200)
			resp.json(json)
		}
	})
})

app.get(BASE + 'events/get/:event_id', function(req, resp) {
	console.log('GET events/get/:id')
	const id = req.params.event_id
	var found = false
	
	withEvents(function(events){
	
		events.some(function(event) {
			if(event.event_id == id){
				resp.setHeader('Content-Type', 'application/json')
				resp.status(200)
				resp.json(event)
				found = true
				return true
			}
		})
		
		if(!found){
			const json = {}
			json.error = 'no such event'
			resp.setHeader('Content-Type', 'application/json')
			resp.status(404)
			resp.json(json)
		}
	})
})

app.post(BASE + 'venues/add', function(req, resp) {
	console.log('POST venues/add')
	
	const auth_token = req.body.auth_token
	const ip = req.ip
	
	const name = req.body.name
	const postcode = req.body.postcode
	const town = req.body.town
	const url = req.body.url
	const icon = req.body.icon
	
	if(auth(auth_token, ip)){
		withVenues(function(venues){
			var id = 'v_1'
			if(venues.length){
				const last_id = venues[venues.length - 1].venue_id
				id = 'v_' + (parseInt(last_id.substring(2,last_id.length), 10) + 1)
			}
			const venue = new Venue(id, name, postcode, town, url, icon)
			venues.push(venue)
			const json = {}
			json.success = 'successful'
			resp.setHeader('Content-Type', 'application/json')
			resp.status(200)
			resp.json(json)
			saveVenues(venues)
			console.log('POST venues/add success')
		})
	}
	else{
		const json = {}
		json.error = 'not authorised, wrong token'
		resp.setHeader('Content-Type', 'application/json')
		resp.status(401)
		resp.json(json)
		console.log('POST venues/add fail')
	}
})

app.post(BASE + 'events/add', function(req, resp) {
	console.log('POST events/add')
	
	const auth_token = req.body.auth_token
	const ip = req.ip
	
	var event_id = req.body.event_id
	const title = req.body.title
	const venue_id = req.body.venue_id
	const date = req.body.date
	const url = req.body.url
	const blurb = req.body.blurb
	
	if(auth(auth_token, ip)){
		withEvents(function(events){
			withVenues(function(venues){
				if(!event_id){
					var nextId = (Math.max.apply(null, events.map(function(event){
						const id = event.event_id
						return id.substring(2,id.length)
					}))+1)
					if(nextId > 0){
						event_id = 'e_' + nextId
					}
					else{
						event_id = 'e_1'
					}
				}
				
				var venue
				venues.some(function(v) {
					if(v.venue_id == venue_id){
						venue = v
						return true
					}
				})
				
				if(venue){
					events = events.filter(function(event) { return event.id != event_id })
					const event = new Event(event_id, title, blurb, date, url, venue)
					events.push(event)
					const json = {}
					json.success = 'successful'
					resp.setHeader('Content-Type', 'application/json')
					resp.status(200)
					resp.json(json)
					saveEvents(events)
				}
				else{
					const json = {}
					json.error = 'venue not found'
					resp.setHeader('Content-Type', 'application/json')
					resp.status(400)
					resp.json(json)
				}
			})
		})
	}
	else{
		const json = {}
		json.error = 'not authorised, wrong token'
		resp.setHeader('Content-Type', 'application/json')
		resp.status(401)
		resp.json(json)
	}
})


//                  _    _     
//     /\          | |  | |    
//    /  \   _   _ | |_ | |__  
//   / /\ \ | | | || __|| '_ \ 
//  / ____ \| |_| || |_ | | | |
// /_/    \_\\__,_| \__||_| |_|

//User accounts
accounts = []
function Account (user, pass) {
	this.user = user;
	this.pass = pass;
}
accounts.push(new Account('admin', 'pass'))

//Authentication Tokens
tokens = []
function Token (ip, token, expiry) {
	this.ip = ip
	this.token = token
	this.expiry = expiry
}

function auth(token, ip){
	console.log('AUTH from ' + ip + ' with token ' + token)
	
	//Check for durham uni ip
	if(ip.match(new RegExp('.*129\.234\.\d{1,3}\.\d{1,3}.*'))){
		if(token == 'concertina'){
			console.log('AUTH success (durham uni)')
			return true
		}
	}
	
	const date = new Date()

	tokens = tokens.filter(function(auth_token){ //Remove expired tokens
		const dif = date.getDate() - auth_token.expiry.getDate()
		return dif < 1000 * 3600 * 2		
	})

	var found = false
	tokens.some(function(auth_token){
		if(auth_token.token == token){
			if(auth_token.ip == ip){
				const dif = date.getDate() - auth_token.expiry.getDate()
				if(dif < 1000 * 3600 * 2){
					found = true
					return true
				}
			}
		}
	})
	
	if(found){
		console.log('AUTH success')
	}
	else{
		console.log('AUTH fail')
		console.log(tokens)
	}
	
	return found
}

//https://stackoverflow.com/questions/105034/create-guid-uuid-in-javascript
function uuid() { //We use UUIDs as Auth Tokens
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

app.post(BASE + 'auth/new', function(req, resp) { //Get a new authentication token
	console.log('POST auth')
	const user = req.body.user
	const pass = req.body.pass
	
	const accept = accounts.some(function(account){
		return account.user == user && account.pass == pass
	})
	
	if(accept){
		var ip = req.query.ip //Use client IP if no IP supplied
		if(!ip){
			ip = req.ip
		}
		
		const token = uuid()
		const expiry = new Date()
		expiry.setHours(expiry.getHours() + 2) //Tokens expire after 2 hours
		
		const auth_token = new Token(ip, token, expiry)
		tokens.push(auth_token)
		
		const json = {}
		json.token = token
		resp.setHeader('Content-Type', 'application/json')
		resp.status(200)
		resp.json(json)
		console.log('POST auth success')
	}
	else{
		const json = {}
		json.error = 'not authorised, username or password incorrect'
		resp.setHeader('Content-Type', 'application/json')
		resp.status(401)
		resp.json(json)
		console.log('POST auth fail')
	}
})

app.get(BASE + 'auth/check', function(req, resp) { //Check if a token is valid
	console.log('GET auth')
	
	const token = req.query.token
	const ip = req.ip
	
	if(auth(token, ip)){
		const json = {}
		json.valid = true
		resp.setHeader('Content-Type', 'application/json')
		resp.status(200)
		resp.json(json)
	}
	else{
		const json = {}
		json.valid = false
		json.error = 'not authorised, username or password incorrect'
		resp.setHeader('Content-Type', 'application/json')
		resp.status(200)
		resp.json(json)
	}
})


//  _____              
// |  __ \              
// | |__) |_   _  _ __  
// |  _  /| | | || '_ \ 
// | | \ \| |_| || | | |
// |_|  \_\\__,_||_| |_|

app.listen(8090)
console.log('Loaded')