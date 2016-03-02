const fetch = require('node-fetch')
const Bacon = require('baconjs')


const low = require('lowdb')
const storage = require('lowdb/file-sync')
const db = low('db.json', { storage })

const config = require('./config')


function parseStatus(status) {
	return {
		author: status.from.name,
		message: status.message,
		permalink: 'https://facebook.com/' + status.id,
		attachment: status.attachments ? status.attachments.data : false,
		link: status.link,
		updated_time: status.updated_time,
	}
}


function formatSlackUpdate(status) {	
	return JSON.stringify({
		attachments: [
			{
				title: '<' + status.permalink + '|Facebook Post to Group> on ' + status.updated_time,
				text: status.message,
				color: '#f5a'
			}
		]
	})
}

function sendToSlack(status) {
	const stored = db('posts').find({ permalink: status.permalink })

	if(!stored) {
		fetch(config.slack_webook_url, {
				method: 'post',
				headers: {
					'Accept': 'application/json',
					'Content-Type': 'application/json'
				},
				body: formatSlackUpdate(status)
			})
		    .then(res => console.log(status.permalink + ' was sent to Slack.'))
		    .then(() => db('posts').push(status))
	}
	return status
}

function getFacebookGroup(group_id) {
	console.log('Group:', group_id)

	const url = 'https://graph.facebook.com/' +
		group_id + '/feed' +
		'?access_token=' + config.fb_token +
		'&fields=message,updated_time,id,caption,attachments,from,child_attachments,likes{name,link},link'

	const promise = fetch(url)
		.then(response => response.json())
		.then( parsed => 
			parsed.data
				.map(parseStatus)
		)


	return Bacon.fromPromise(promise)
}

const stream = new Bacon.Bus()

stream
	.flatMap(getFacebookGroup)
	.map(messages => messages.forEach(sendToSlack))
	.onValue(() => console.log('Completed Processing'))

config.facebook_groups.forEach((group_id) => stream.push(group_id))
	
