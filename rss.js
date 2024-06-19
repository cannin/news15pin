// This function takes an XML string and converts it to a JavaScript object in the desired format
function parseOPML(xmlString, ignoreTopics, ignoreTitles) {
    // Parse the XML string
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "application/xml");

    // Initialize the result object
    const result = [];

    // Find all 'outline' elements that are direct children of 'body'
    const topics = xmlDoc.querySelectorAll("body > outline");

    // Iterate through each topic
    topics.forEach(topic => {
        const topicTitle = topic.getAttribute("title");
        console.log('CUR TOPIC TITLE: ', topicTitle);

        if(ignoreTopics.includes(topicTitle)) {
            console.log('IGNORE TOPIC: ', topicTitle);
            return;
        }

        const topicObj = {
            topic: topicTitle,
            items: []
        };

        // Find all 'outline' elements that are children of this topic
        const items = topic.querySelectorAll("outline");

        // Iterate through each item
        items.forEach(item => {
            const itemTitle = item.getAttribute("title");
            console.log('CUR ITEM TITLE: ', itemTitle);


            if(ignoreTitles.includes(itemTitle)) {
                console.log('IGNORE ITEM: ', itemTitle);
                return;
            }

            topicObj.items.push({
                title: itemTitle,
                xmlUrl: item.getAttribute("xmlUrl")
            });
        });

        // Add the topic object to the result array
        result.push(topicObj);
    });

    return result;
}

// Function to extract a random items from each topic
function getRandomItemsFromEachTopic(data, n) {
    return data.map(topic => {
        // Check if the number of requested items is more than available items
        if (n > topic.items.length) {
            console.warn("Requested more items than are available in topic:", topic.topic);
            return {
                topic: topic.topic,
                items: topic.items // Return all items if n is larger than the item list
            };
        }

        // Helper function to generate n unique random indices
        const getRandomIndices = (count, max) => {
            const indices = new Set();
            while (indices.size < count) {
                const randomIndex = Math.floor(Math.random() * max);
                indices.add(randomIndex);
            }
            return Array.from(indices);
        };

        // Generate n unique indices
        const randomIndices = getRandomIndices(n, topic.items.length);

        // Map indices to items
        return {
            topic: topic.topic,
            items: randomIndices.map(index => topic.items[index])
        };
    });
}

// Function to truncate string
function truncateString(str, maxLength) {
    if (str.length <= maxLength) return str; // Check if truncation is needed

    // Truncate string to the maximum length without cutting in the middle of a word
    const truncated = str.slice(0, maxLength + 1).split(" ").slice(0, -1).join(" ");

    return truncated + ' ...'; // Add ellipsis to indicate truncation
}

// Function to fetch RSS data and parse it
async function fetchAndParseRSS(url, topic) {
    const n = topicPriority[topic];
    console.log('RSS URL: ', url);

    try {
      await new Promise(resolve => setTimeout(resolve, 5));

      // Fetch the RSS XML data
      const response = await fetch(url);
      let xmlText = await response.text();
      console.log('RSS XML DOWNLOAD DONE: ');
      //console.log('RSS XML DOWNLOAD DONE: ', xmlText);

      if(xmlText === 'Internal Server Error') {
        return null;
      }

      const result = await parseRSS(xmlText, topic, n);
      console.log('RSS PARSE DONE: ', result);

      return result;
    } catch (error) {
      console.error("Failed to fetch or parse RSS: URL: ", url, "ERROR: ", error);
      return null;
    }
  }

function parseRSS(xmlText, topic, n) {
    let contentContainer = document.getElementById('rss');
    
    // Parse the XML text
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "application/xml");
    console.log('RSS PARSE DONE');

    let channel = '';
    let channel_title = null;
    let items = null;

    // Parse channel title and items ----
    if (xmlDoc.querySelector("channel") !== null) {
        channel = xmlDoc.querySelector("channel");
        
        channel_title = channel.querySelector("title").textContent;
        console.log('RSS TITLE EXTRACTION DONE: CHANNEL');
        items = channel.querySelectorAll("item");
        console.log('RSS ITEM EXTRACTION DONE: CHANNEL');
    }

    if (xmlDoc.querySelector("feed") !== null) {
        channel = xmlDoc.querySelector("feed"); 

        channel_title = xmlDoc.querySelector("title").textContent;
        console.log('RSS TITLE EXTRACTION DONE: NO CHANNEL');

        items = channel.querySelectorAll("entry");
        console.log('RSS ITEM EXTRACTION DONE: NO CHANNEL');
    }
    console.log('RSS CHANNEL EXTRACTION DONE');

    console.log('CHANNEL TITLE: ', channel_title);
    contentContainer.textContent = 'Fetching: ' + channel_title + ' ...';

    const result = {
        title: truncateString(channel_title, 45),
        topic: topic,
        items: []
    };

    // Iterate through each item and format it according to the specifications
    for (let i = 0; i < Math.min(n, items.length); i++) {
        const item = items[i];
        let title = item.querySelector("title").textContent;

        let date = '';
        let description = '';
        let link = '';
        let domain = ''; 

        let match = null;

        date_regex_1 = /(\d{1,2} \w+) \d{4}/;
        date_regex_2 = /\d{4}-(\d{2}-\d{2})/;

        // Parse date ----
        if(item.querySelector("pubDate") !== null) {
            date = item.querySelector("pubDate").textContent;

            match = date.match(date_regex_1);
            if(match) {
                date = match[1].trim();
            } else {
                match = date.match(date_regex_2);
                date = match[1].trim();
            }
        }

        if (item.querySelector("published") !== null) {
            date = item.querySelector('published').textContent;

            // Regular expression to extract the month and day
            match = date.match(date_regex_2);
            date = match[1].trim();
        }

        // Parse description ----
        if(item.querySelector("description") !== null) {
            description = item.querySelector("description").textContent;
        }

        if (item.querySelector("summary") !== null) {
            description = item.querySelector("summary").textContent;;
        }

        if(item.querySelector("content") !== null) {
            description = item.querySelector("content").textContent;
        }

        // Parse link ----
        link = item.querySelector("link");

        if (link && link.hasAttribute('href')) {
            link = link.getAttribute('href');
            domain = getDomainFromUrl(link);
        } else {
            link = item.querySelector("link").textContent;
            domain = getDomainFromUrl(link);
        }

        title = truncateString(title, 90);
        title = title + ' (' + domain + ', ' + date + ')';
        description = truncateString(description, 90);

        result.items.push({
            title: title,
            description: description,
            link: link,
            pubDate: date
        });
    }

    return result;
}

// Undo nested topics
function flattenTopics(data) {
    // Use the reduce function to accumulate all items into a single array
    return data.reduce((acc, current) => {
        // Concatenate the current items to the accumulator
        return acc.concat(current.items);
    }, []); // Start with an empty array as the accumulator
}

async function processTopics(topics) {
    const results = [];

    for (let i = 0; i < topics.length; i++) {
        const topic = topics[i];
        document.querySelector('progress').setAttribute('value', (i / topics.length) * 100);

        // Check if the topic has multiple items and handle them
        if (topic.items && topic.items.length) {
            const feedDataArray = [];
            for (const item of topic.items) {
                let url = item.xmlUrl;

                // Encode to handle params in the URL
                url = encodeURIComponent(url); 
                url = proxyUrl + url;

                const feedData = await fetchAndParseRSS(url, topic.topic);
                if (feedData) {
                    feedDataArray.push(feedData);  // Collect all feed data for the current topic
                }
            }

            // After collecting data for all items in a topic, push it to results
            if (feedDataArray.length > 0) {
                results.push({
                    items: feedDataArray  // Append all feed data associated with the topic
                });
            }
        } else {
            console.log("No items found in topic:", topic.topic);
        }
    }

    console.log("ALL TOPICS: ", results);
    return results;
}

// Get Domain from URL
function getDomainFromUrl(urlString) {
    console.log('URL STRING: ', urlString);

    try {
        // Create a URL object from the input string
        const url = new URL(urlString);

        // Get the hostname from the URL object
        const hostname = url.hostname;

        // Split the hostname into parts
        const domainParts = hostname.split('.');

        // If the hostname has more than two parts, assume it includes subdomains and extract only the last two parts
        // Otherwise, return the hostname as is
        const domain = domainParts.length > 2 ? domainParts.slice(-2).join('.') : hostname;

        return domain;
    } catch (e) {
        console.error('Invalid URL:', e);
        return null; // Return null or appropriate error handling
    }
}

// Main function loop
function main() {
    let contentContainer = document.getElementById('rss');

    // REDDIT format: http://www.reddit.com/r/nudisco/new/.rss
    fetch('feeds.opml')
        .then(response => response.text())
        .then(opmlData => { 
            const data = parseOPML(opmlData, ignoreTopics, ignoreTitles);
            contentContainer.textContent = 'Parsing OPML ...';
            console.log('MAIN: DATA: ', data);
            return data; 
        })
        .then(data => {
            const subset = getRandomItemsFromEachTopic(data, n_sources);
            console.log('MAIN: SUBSET: ', subset);
            return subset;
        })
        .then(subset => {
            const data = processTopics(subset);
            contentContainer.textContent = 'Parsing topics ...';
            console.log('MAIN: TOPICS: ', subset);
            return data;
        })
        .then(data => {
            items = flattenTopics(data);
            console.log('MAIN: FLATTENED TOPICS: ', items);
    
            // Custom sort function to order by the topic priorities defined
            items.sort((a, b) => topicPriority[b.topic] - topicPriority[a.topic]);
    
            console.log('MAIN: SORTED TOPICS: ', items);
            
            // Clear the content container before adding news items
            contentContainer.textContent = '';
    
            if(items.length === 0) {
                contentContainer.textContent = 'No items found';
            } else {
                items.forEach(entry => {
                    // Create and add the header
                    const header = document.createElement('h1');
                    header.textContent = entry.title + ' (' + entry.topic + ')';
                    contentContainer.appendChild(header);
    
                    // Create and add the list
                    const list = document.createElement('ul');
                    entry.items.forEach(item => {
                        const listItem = document.createElement('li');
                        const link = document.createElement('a');

                        // Remove parameters on links associated with tracking
                        let itemLink = item.link;
                        itemLink = itemLink.split('?')[0]

                        link.href = itemLink;
                        link.target = '_blank';
                        link.textContent = item.title;
    
                        listItem.appendChild(link);
                        list.appendChild(listItem);
                    });
    
                    contentContainer.appendChild(list);
                });
            }

            // Remove progress bar and add the results
            document.querySelector('progress').remove();
        });
}

// Priority of topics; higher number, higher priority; 
// also the number of articles to select
const topicPriority = {
    "news": 5,
    "tech": 3,
    "art": 3,
    "etc": 3,
    "music": 3,
    "politics": 2,
    "science": 2,
    "science.bioinformatics": 2,
    "tech.sec": 2,
    "etc.sec": 1,
    "science.research": 1
};

// List of RSS topics to ignore
const ignoreTopics = [
    'Must Read'
];

// List of RSS feeds to ignore
const ignoreTitles = [
    'Harvard University Gazette',
    'Altmetric Ranked Biomedical Research Articles',
    'Everything',
    'Wooster Collective',
    'NOTCOT.ORG',
    'Explore Flickr',
    'FECAL FACE DOT COM',
    'Fstoppers',
    'Spin Magazine Online -',
    'The Allmusic Blog'
];

// Number of sources to select from each topic
let n_sources = 2;

// Get the value of 'sources' or 's' if specified in the URL
const params = new URL(window.location.href).searchParams;
if (params.get('sources') !== null && params.get('sources') !== '') {
    let value = params.get('sources');
    value = parseInt(value);

    if (!isNaN(value) && value > 0) {
        n_sources = value;
    }
}

if (params.get('s') !== null && params.get('s') !== '') {
    let value = params.get('s');
    value = parseInt(value);

    if (!isNaN(value) && value > 0) {
        n_sources = value;
    }
}

// Proxy URL
const proxyUrl = 'https://w3kjl7phz5lslxrhzapi7wasx40msjqd.lambda-url.us-east-1.on.aws/?url=';

// Run main function
main();