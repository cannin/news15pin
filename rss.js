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

// Function to extract the first item from each topic
function getFirstItemFromEachTopic(data) {
    return data.map(topic => {
        return {
            topic: topic.topic,
            item: topic.items[0] // Select the first item
        };
    });
}

// Function to extract a random item from each topic
function getRandomItemFromEachTopic(data) {
    return data.map(topic => {
        const randomIndex = Math.floor(Math.random() * topic.items.length); // Calculate a random index
        return {
            topic: topic.topic,
            item: topic.items[randomIndex] // Select a random item
        };
    });
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

    // Replace 'http' with 'https' in the URL
    //url = replaceWithHttps(url);

    try {
      await new Promise(resolve => setTimeout(resolve, 100));

      // Fetch the RSS XML data
      const response = await fetch(url);
      let xmlText = await response.text();
      console.log('RSS XML DOWNLOAD DONE: ', xmlText);

      if(xmlText === 'Internal Server Error') {
        return null; 
      }

      const result = await parseRSS(xmlText, topic, n);
      console.log('RSS PARSE DONE: ', result);

      // BAD ATTEMPTS ----
      //const r1 = await fetch(url) 
      //  .then(r1 => console.log("X1: ", r1.text())); NOPE
      //const response = await fetch(url);
      //const xmlText = await response.text();
      //const result = await parseRSS(xmlText);
      
      return result;
    } catch (error) {
      console.error("Failed to fetch or parse RSS: URL: ", url, "ERROR: ", error);
      return null;
    }
  }

function parseRSS(xmlText, topic, n) {
    // Parse the XML text
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "application/xml");
    console.log('RSS PARSE DONE');

    // Extract and process the channel information and items
    let channel = xmlDoc.querySelector("channel");
    console.log('RSS CHANNEL EXTRACTION DONE');

    let channel_title = null; 
    let items = null; 

    if (channel === null) {
        channel = xmlDoc.querySelector("title");
        channel_title = channel.textContent;
        console.log('RSS TITLE EXTRACTION DONE: NO CHANNEL');

        items = channel.querySelectorAll("entry");
        console.log('RSS ITEM EXTRACTION DONE: NO CHANNEL');
    } else {
        channel_title = channel.querySelector("title").textContent;
        console.log('RSS TITLE EXTRACTION DONE: CHANNEL');
        items = channel.querySelectorAll("item");
        console.log('RSS ITEM EXTRACTION DONE: CHANNEL');
    }

    console.log('CHANNEL TITLE: ', channel_title);

    const result = {
        title: truncateString(channel_title, 45),
        topic: topic,
        items: []
    };

    // Iterate through each item and format it according to the specifications
    for (let i = 0; i < Math.min(n, items.length); i++) {
        const item = items[i];
        let title = item.querySelector("title").textContent;
        const domain = getDomainFromUrl(item.querySelector("link").textContent);

        let date = '';
        let description = '';

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

        title = truncateString(title, 90);
        title = title + ' (' + domain + ', ' + date + ')';
        description = truncateString(description, 90);

        result.items.push({
            title: title,
            description: description,
            link: item.querySelector("link").textContent,
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

function replaceWithHttps(url) {
    // Use replace() with a regular expression that targets 'http' at the start of the URL
    return url.replace(/^http:\/\//, 'https://');
}

async function processTopics(topics) {
    const results = [];

    for (const topic of topics) {
        // Check if the topic has multiple items and handle them
        if (topic.items && topic.items.length) {
            const feedDataArray = [];
            for (const item of topic.items) {
                let url = item.xmlUrl;

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
    } catch (error) {
        console.error('Invalid URL:', error);
        return null; // Return null or appropriate error handling
    }
}

// OPML
// Your OPML data as a string here
const opmlData = '<opml version="1.0"><head><title>A subscriptions in feedly Cloud</title></head><body><outline text="Must Read" title="Must Read"/><outline text="art" title="art"><outline type="rss" text="Featured Projects" title="Featured Projects" xmlUrl="http://feeds.feedburner.com/behance/vorr" htmlUrl="http://www.behance.net"/><outline type="rss" text="NOTCOT.ORG" title="NOTCOT.ORG" xmlUrl="http://www.notcot.org/atom.php" htmlUrl="http://www.notcot.org/"/><outline type="rss" text="Colossal" title="Colossal" xmlUrl="https://www.thisiscolossal.com/feed/" htmlUrl="https://www.thisiscolossal.com/"/><outline type="rss" text="Massachusetts Cultural Council" title="Massachusetts Cultural Council" xmlUrl="http://feeds.feedburner.com/Artsake" htmlUrl="https://artsake.massculturalcouncil.org/"/><outline type="rss" text="Explore Flickr" title="Explore Flickr" xmlUrl="http://feeds.feedburner.com/explore_flickr_rss" htmlUrl="http://lunean.com/explore_flickr_rss/rss_tmp.xml"/><outline type="rss" text="Yanko Design" title="Yanko Design" xmlUrl="http://www.yankodesign.com/feed/" htmlUrl="https://www.yankodesign.com"/><outline type="rss" text="COOL HUNTING®" title="COOL HUNTING®" xmlUrl="http://www.coolhunting.com/atom.xml" htmlUrl="https://coolhunting.com"/><outline type="rss" text="Design You Trust" title="Design You Trust" xmlUrl="http://designyoutrust.com/feed/" htmlUrl="https://designyoutrust.com"/><outline type="rss" text="FECAL FACE DOT COM" title="FECAL FACE DOT COM" xmlUrl="http://feeds.feedburner.com/FecalFaceDotCom" htmlUrl="http://www.fecalface.com/SF/"/><outline type="rss" text="CreativeApplications.Net" title="CreativeApplications.Net" xmlUrl="http://feeds.feedburner.com/creativeapplicationsnet" htmlUrl="https://www.creativeapplications.net"/><outline type="rss" text="Its Nice That" title="Its Nice That" xmlUrl="http://feeds2.feedburner.com/itsnicethat/SlXC" htmlUrl="http://www.itsnicethat.com/"/><outline type="rss" text="FlowingData" title="FlowingData" xmlUrl="http://feeds.feedburner.com/FlowingData" htmlUrl="https://flowingdata.com"/><outline type="rss" text="Information Is Beautiful" title="Information Is Beautiful" xmlUrl="http://feeds.feedburner.com/InformationIsBeautiful" htmlUrl="https://informationisbeautiful.net"/><outline type="rss" text="News: Datablog | guardian.co.uk" title="News: Datablog | guardian.co.uk" xmlUrl="http://www.guardian.co.uk/news/datablog/rss" htmlUrl="https://www.theguardian.com/news/datablog"/><outline type="rss" text="Buamai" title="Buamai" xmlUrl="http://www.buamai.com/feed" htmlUrl="https://buamai.com/"/><outline type="rss" text="Core77" title="Core77" xmlUrl="http://feeds.feedburner.com/core77/blog" htmlUrl="http://core77.com/home/rss"/><outline type="rss" text="Designboom" title="Designboom" xmlUrl="http://www.designboom.com/weblog/rss.php" htmlUrl="https://www.designboom.com/"/><outline type="rss" text="Dezeen" title="Dezeen" xmlUrl="http://feeds.feedburner.com/dezeen" htmlUrl="https://www.dezeen.com"/><outline type="rss" text="Fstoppers" title="Fstoppers" xmlUrl="http://feeds.feedburner.com/fstoppersfeed" htmlUrl="https://fstoppers.com/"/><outline type="rss" text="Archinect.com Feed" title="Archinect.com Feed" xmlUrl="http://feeds2.feedburner.com/archinect" htmlUrl="https://archinect.com/"/><outline type="rss" text="Wooster Collective" title="Wooster Collective" xmlUrl="http://woostercollective.com/rss/index.xml" htmlUrl="http://www.woostercollective.com/"/></outline><outline text="etc.sec" title="etc.sec"><outline type="rss" text="Boing Boing" title="Boing Boing" xmlUrl="http://boingboing.net/index.rdf" htmlUrl="https://boingboing.net/"/><outline type="rss" text="The New Yorker" title="The New Yorker" xmlUrl="http://www.newyorker.com/services/rss/feeds/everything.xml" htmlUrl="https://www.newyorker.com/culture"/><outline type="rss" text="Slate - Culture" title="Slate - Culture" xmlUrl="http://www.slate.com/rss" htmlUrl="https://slate.com/culture"/><outline type="rss" text="Editors Picks Articles on Seeking Alpha" title="Editors Picks Articles on Seeking Alpha" xmlUrl="http://seekingalpha.com/tag/editors-picks.xml" htmlUrl="https://seekingalpha.com"/><outline type="rss" text="Longreads" title="Longreads" xmlUrl="http://longreads.com/rss" htmlUrl="https://longreads.com/"/><outline type="rss" text="Harvard University Gazette" title="Harvard University Gazette" xmlUrl="http://www.trumba.com/calendars/gazette.rss" htmlUrl="https://news.harvard.edu/gazette/harvard-events/events-calendar/"/><outline type="rss" text="Fark.com RSS" title="Fark.com RSS" xmlUrl="http://www.fark.com/fark.rss" htmlUrl="https://www.fark.com/"/><outline type="rss" text="The Onion" title="The Onion" xmlUrl="http://www.theonion.com/content/feeds/daily" htmlUrl="https://www.theonion.com"/></outline><outline text="etc" title="etc"><outline type="rss" text="The New Yorker" title="The New Yorker" xmlUrl="http://www.newyorker.com/services/rss/feeds/everything.xml" htmlUrl="https://www.newyorker.com/culture"/><outline type="rss" text="The Atlantic — News and analysis on politics, business, culture ..." title="The Atlantic — News and analysis on politics, business, culture ..." xmlUrl="http://feeds.feedburner.com/TheAtlantic" htmlUrl="https://www.theatlantic.com/"/><outline type="rss" text="AllSides Balanced News Feed" title="AllSides Balanced News Feed" xmlUrl="https://www.allsides.com/news/rss" htmlUrl="https://www.allsides.com/rss/news"/><outline type="rss" text="Aeon | a world of ideas" title="Aeon | a world of ideas" xmlUrl="https://aeon.co/feed.rss" htmlUrl="https://aeon.co"/><outline type="rss" text="Nautilus" title="Nautilus" xmlUrl="https://nautil.us/feed/" htmlUrl="https://nautil.us/"/><outline type="rss" text="Gizmodo" title="Gizmodo" xmlUrl="http://feeds.gawker.com/io9/vip" htmlUrl="https://gizmodo.com"/><outline type="rss" text="Internet Meme Database | Know Your Meme" title="Internet Meme Database | Know Your Meme" xmlUrl="http://knowyourmeme.com/newsfeed.rss" htmlUrl="https://knowyourmeme.com"/><outline type="rss" text="The New Republic" title="The New Republic" xmlUrl="http://www.newrepublic.com/rss.xml" htmlUrl="https://newrepublic.com"/><outline type="rss" text="Reason Magazine" title="Reason Magazine" xmlUrl="http://feeds.feedburner.com/reason/AllArticles" htmlUrl="https://reason.com/latest/"/><outline type="rss" text="ProPublica" title="ProPublica" xmlUrl="http://feeds.propublica.org/propublica/main" htmlUrl="https://www.propublica.org/"/><outline type="rss" text="MetaFilter" title="MetaFilter" xmlUrl="http://xml.metafilter.com/rss.xml" htmlUrl="https://www.metafilter.com/"/><outline type="rss" text="kottke.org" title="kottke.org" xmlUrl="http://feeds.kottke.org/main" htmlUrl="https://kottke.org/"/><outline type="rss" text="VICE RSS Feed" title="VICE RSS Feed" xmlUrl="http://www.vice.com/rss" htmlUrl="https://www.vice.com/en%3Flocale%3Den_us"/><outline type="rss" text="Laughing Squid" title="Laughing Squid" xmlUrl="http://feeds.laughingsquid.com/laughingsquid" htmlUrl="https://laughingsquid.com/"/></outline><outline text="music" title="music"><outline type="rss" text="The Allmusic Blog" title="The Allmusic Blog" xmlUrl="http://blog.allmusic.com/feed/" htmlUrl="https://www.allmusic.com/blog/"/><outline type="rss" text="FACT magazine: music and art" title="FACT magazine: music and art" xmlUrl="http://www.factmag.com/feed/" htmlUrl="https://www.factmag.com/"/><outline type="rss" text="Mixmag  - The worlds biggest dance music and clubbing magazine" title="Mixmag  - The worlds biggest dance music and clubbing magazine" xmlUrl="http://www.mixmag.net/rss.xml" htmlUrl="https://mixmag.net/"/><outline type="rss" text="Spin Magazine Online -" title="Spin Magazine Online -" xmlUrl="http://www.spin.com/rss.xml" htmlUrl="https://www.spin.com/"/></outline><outline text="science" title="science"><outline type="rss" text="ScienceNOW" title="ScienceNOW" xmlUrl="http://sciencenow.sciencemag.org/rss/current.xml" htmlUrl="https://www.science.org/news"/><outline type="rss" text="Science News - The New York Times" title="Science News - The New York Times" xmlUrl="http://www.nytimes.com/services/xml/rss/nyt/Science.xml" htmlUrl="https://www.nytimes.com/section/science"/><outline type="rss" text="Livescience.com" title="Livescience.com" xmlUrl="http://feeds.feedburner.com/Livesciencecom" htmlUrl="https://www.livescience.com"/><outline type="rss" text="KDnuggets" title="KDnuggets" xmlUrl="http://feeds.feedburner.com/kdnuggets-data-mining-analytics" htmlUrl="https://www.kdnuggets.com"/><outline type="rss" text="Scientific Blogging: Michael Shermer Scientific Blogging article" title="Scientific Blogging: Michael Shermer Scientific Blogging article" xmlUrl="http://www.scientificblogging.com/rss.xml" htmlUrl="https://www.science20.com"/><outline type="rss" text="National Institutes of Health (NIH) News Releases" title="National Institutes of Health (NIH) News Releases" xmlUrl="http://www.nih.gov/news/feed.xml" htmlUrl="https://www.nih.gov/"/><outline type="rss" text="Machine Learning Mastery" title="Machine Learning Mastery" xmlUrl="http://machinelearningmastery.com/feed/" htmlUrl="https://machinelearningmastery.com/"/></outline><outline text="politics" title="politics"><outline type="rss" text="Raw Story - Celebrating 20 Years of Independent Journalism" title="Raw Story - Celebrating 20 Years of Independent Journalism" xmlUrl="http://feeds.feedburner.com/rawstory/gKpz" htmlUrl="https://www.rawstory.com/"/><outline type="rss" text="Politico " title="Politico " xmlUrl="http://feeds.politico.com/politico/rss/politicopicks" htmlUrl="https://www.politico.com/"/></outline><outline text="tech" title="tech"><outline type="rss" text="MarkTechPost" title="MarkTechPost" xmlUrl="https://www.marktechpost.com/feed/" htmlUrl="https://www.marktechpost.com/"/><outline type="rss" text="TorrentFreak" title="TorrentFreak" xmlUrl="http://feeds.feedburner.com/Torrentfreak" htmlUrl="https://torrentfreak.com/"/><outline type="rss" text="Bioconductor Forum latest!" title="Bioconductor Forum latest!" xmlUrl="https://support.bioconductor.org/feeds/latest/" htmlUrl="https://support.bioconductor.org/"/><outline type="rss" text="Hacker News" title="Hacker News" xmlUrl="https://news.ycombinator.com/rss" htmlUrl="https://news.ycombinator.com/"/><outline type="rss" text="programming - Reddit" title="programming - Reddit" xmlUrl="http://www.reddit.com/r/programming/.rss" htmlUrl="https://www.reddit.com/r/programming/"/><outline type="rss" text="𝚓𝚊𝚟𝚊𝚜𝚌𝚛𝚒𝚙𝚝" title="𝚓𝚊𝚟𝚊𝚜𝚌𝚛𝚒𝚙𝚝" xmlUrl="http://www.reddit.com/r/javascript/.rss" htmlUrl="https://www.reddit.com/r/javascript/"/><outline type="rss" text="Omics! Omics!" title="Omics! Omics!" xmlUrl="http://omicsomics.blogspot.com/feeds/posts/default" htmlUrl="http://omicsomics.blogspot.com/"/><outline type="rss" text="R-bloggers" title="R-bloggers" xmlUrl="http://feeds.feedburner.com/RBloggers" htmlUrl="https://www.r-bloggers.com"/><outline type="rss" text="Papers with Code: Trending (unofficial)" title="Papers with Code: Trending (unofficial)" xmlUrl="https://us-east1-ml-feeds.cloudfunctions.net/pwc/trending" htmlUrl="https://github.com/ml-feeds/pwc-feeds"/><outline type="rss" text="Towards Data Science" title="Towards Data Science" xmlUrl="https://medium.com/feed/towards-data-science" htmlUrl="https://towardsdatascience.com?source=rss----7f60cf5620c9---4"/><outline type="rss" text="Awesome bioRxiv" title="Awesome bioRxiv" xmlUrl="http://feeds.feedburner.com/bx6" htmlUrl="http://github.com/dylang/node-rss"/><outline type="rss" text="Deep Learning" title="Deep Learning" xmlUrl="https://www.reddit.com/r/deeplearning/.rss" htmlUrl="https://www.reddit.com/r/deeplearning/"/><outline type="rss" text="Slashdot" title="Slashdot" xmlUrl="https://rss.slashdot.org/Slashdot/slashdotMainatom" htmlUrl="https://slashdot.org/"/><outline type="rss" text="Biostar Forum latest!" title="Biostar Forum latest!" xmlUrl="http://www.biostars.org/feeds/latest/" htmlUrl="https://www.biostars.org/"/><outline type="rss" text="Altmetric Ranked Biomedical Research Articles" title="Altmetric Ranked Biomedical Research Articles" xmlUrl="https://altrss.lunean.com/rss2.xml" htmlUrl="http://lunean.com"/><outline type="rss" text="Machine Learning" title="Machine Learning" xmlUrl="http://www.reddit.com/r/MachineLearning/.rss" htmlUrl="https://www.reddit.com/r/MachineLearning/"/><outline type="rss" text="r/LocalLLaMA" title="r/LocalLLaMA" xmlUrl="https://api.reddit.com/subreddit/LocalLLaMA" htmlUrl="https://www.reddit.com/r/LocalLLaMA/new"/></outline><outline text="news" title="news"><outline type="rss" text="BBC News Top Stories" title="BBC News Top Stories" xmlUrl="https://rsshub.app/bbc/" htmlUrl="https://www.bbc.co.uk/news"/><outline type="rss" text="CNN.com - RSS Channel" title="CNN.com - RSS Channel" xmlUrl="http://rss.cnn.com/rss/cnn_latest.rss" htmlUrl="http://www.cnn.com"/><outline type="rss" text="NYT &gt; Top Stories" title="NYT &gt; Top Stories" xmlUrl="https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml" htmlUrl="https://www.nytimes.com"/><outline type="rss" text="NPR Topics: News" title="NPR Topics: News" xmlUrl="https://feeds.npr.org/1001/rss.xml" htmlUrl="https://www.npr.org/templates/story/story.php?storyId=1001"/><outline type="rss" text="FOX news" title="FOX news" xmlUrl="http://www.foxnews.com/xmlfeed/rss/0,4313,0,00.rss" htmlUrl="https://www.foxnews.com/"/><outline type="rss" text="PBS NewsHour - Nation" title="PBS NewsHour - Nation" xmlUrl="https://www.pbs.org/newshour/feeds/rss/nation" htmlUrl="https://www.pbs.org/newshour/nation"/><outline type="rss" text="Axios" title="Axios" xmlUrl="https://api.axios.com/feed/top/" htmlUrl="https://www.axios.com/"/><outline type="rss" text="Offstream News" title="Offstream News" xmlUrl="http://thecontext.net/index_rss.xml" htmlUrl="https://offstream.news"/><outline type="rss" text="Home - CBSNews.com" title="Home - CBSNews.com" xmlUrl="https://www.cbsnews.com/latest/rss/main" htmlUrl="https://www.cbsnews.com/"/><outline type="rss" text="ABC News: Top Stories" title="ABC News: Top Stories" xmlUrl="http://feeds.abcnews.com/abcnews/topstories" htmlUrl="http://abcnews.go.com/"/></outline><outline text="tech.sec" title="tech.sec"><outline type="rss" text="VentureBeat" title="VentureBeat" xmlUrl="http://venturebeat.com/feed/" htmlUrl="https://venturebeat.com/"/><outline type="rss" text="The Verge - All Posts" title="The Verge - All Posts" xmlUrl="https://www.theverge.com/rss/index.xml" htmlUrl="https://www.theverge.com/"/><outline type="rss" text="TechCrunch" title="TechCrunch" xmlUrl="https://techcrunch.com/feed/" htmlUrl="https://techcrunch.com/"/></outline></body></opml>';

// Priority order for topics
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
    "etc.sec": 1
};

// List of RSS feeds to ignore
const ignoreTopics = [
    'Must Read'
];

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
const n_sources = 2;

// Proxy URL
const proxyUrl = 'https://w3kjl7phz5lslxrhzapi7wasx40msjqd.lambda-url.us-east-1.on.aws/?url=';

const data = parseOPML(opmlData, ignoreTopics, ignoreTitles);
console.log('DATA: ', data);

// Using the function and logging the result
//const subset = getRandomItemFromEachTopic(data);
const subset = getRandomItemsFromEachTopic(data, n_sources);
console.log('SUBSET: ', subset);

// Run the function to process all topics and log the output
processTopics(subset).then(data => {
    items = flattenTopics(data);
    console.log('FLATTENED TOPICS: ', items);

    // Custom sort function to order by the topic priorities defined
    items.sort((a, b) => topicPriority[b.topic] - topicPriority[a.topic]);

    // Custom sort function to access the nested priority value
    // items.sort((a, b) => {
    //     // Default to a large number if no priority is found
    //     //const priorityA = topicInfo[a.topic] ? topicInfo[a.topic].priority : 999;
    //     //const priorityB = topicInfo[b.topic] ? topicInfo[b.topic].priority : 999;

    //     return topicInfo[a.topic].priority - topicInfo[b.topic].priority;
    // });

    console.log('SORTED TOPICS: ', items);

    const contentContainer = document.getElementById('rss');

    if(items.length === 0) {
        const p = document.createElement('p');
        p.textContent = 'No items found';
        contentContainer.appendChild(p);
    } else {
        items.forEach(entry => {
            // Create and add the header
            const header = document.createElement('h4');
            header.textContent = entry.title + ' (' + entry.topic + ')';
            contentContainer.appendChild(header);
    
            // Create and add the list
            const list = document.createElement('ul');
            entry.items.forEach(item => {
                const listItem = document.createElement('li');
                const link = document.createElement('a');
    
                link.href = item.link;
                link.target = '_blank'; 
                link.textContent = item.title;
    
                listItem.appendChild(link);
                list.appendChild(listItem);
            });
            contentContainer.appendChild(list);
        });
    }
});
