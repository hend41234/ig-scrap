package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"regexp"
)

var (
	userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" // Sesuaikan dengan yang ada di ENV
	xIgAppId  = "936619743392459"                           // Sesuaikan dengan yang ada di ENV
	Cookie    = os.Getenv("COOKIE")
)

type EdgeMediaToCaption struct {
	Edges []struct {
		Node struct {
			Text string `json:"text"`
		} `json:"node"`
	} `json:"edges"`
}
type DataStruct struct {
	XDTShortcodeMedia struct {
		VideoUrl      string             `json:"video_url"`
		VideoDuration float64            `json:"video_duration"`
		EdgeMTC       EdgeMediaToCaption `json:"edge_media_to_caption"`
	} `json:"xdt_shortcode_media"`
}
type RespModels struct {
	Data DataStruct `json:"data"`
}

type NewDataModels struct {
	VideoUrl      string  `json:"video_url"`
	VideoDuration float64 `json:"video_duration"`
	Caption       string  `json:"caption"`
}
type NewResponseModels []NewDataModels

func (data NewResponseModels) SaveJson() {
	dataset, err := json.Marshal(data)
	if err != nil {
		log.Fatal("save file output error : ", err)
	}

	err = os.WriteFile(saveDir, dataset, 0644)
	if err != nil {
		log.Fatal("save file output error : ", err)
	}
	log.Println("save success")
}

type OK struct {
	Code int `json:"code"`
}

func getInstagramID(url string) string {
	// Regex untuk menangkap ID dari berbagai format URL Instagram
	// url := "https://www.instagram.com/hend.blingga/reel/C1Blmz2PLgL/"

	// Regex untuk menangkap ID reel
	re := regexp.MustCompile(`reel/([^/]+)/`)

	// Cari match dalam string
	match := re.FindStringSubmatch(url)

	if len(match) > 1 {
		fmt.Println(match[1]) // Output: C1Blmz2PLgL
		return match[1]
	} else {
		fmt.Println("ID tidak ditemukan")
	}
	return ""
}

var (
	listUrl string
	saveDir string
)

func (old_data RespModels) RenewModels() (new_data NewResponseModels) {
	new_data = append(new_data, NewDataModels{
		VideoUrl:      old_data.Data.XDTShortcodeMedia.VideoUrl,
		VideoDuration: old_data.Data.XDTShortcodeMedia.VideoDuration,
		Caption:       old_data.Data.XDTShortcodeMedia.EdgeMTC.Edges[0].Node.Text,
	})
	return
}

type Link struct {
	Link string
}

func OpenList() []Link {
	file, err := os.Open(listUrl)
	if err != nil {
		log.Fatal("file not found : ", err)
	}

	var links []Link
	if err := json.NewDecoder(file).Decode(&links); err != nil {
		log.Fatal(err)
	}
	return links
}
func main() {
	flag.StringVar(&listUrl, "list", "", "list url json e.g : -list list.json ")
	flag.StringVar(&saveDir, "save", "urls.json", "directory save e.g : -save urls.json")
	flag.Parse()
	if listUrl == "" {
		flag.PrintDefaults()
		return
	}

	urls := "https://www.instagram.com/api/graphql"
	//https://www.instagram.com/api/graphql?variables={"shortcode":"Cr9hF0QBywM"}&doc_id=10015901848480474&lsd=AVqbxe3J_YA
	// content := "https://www.instagram.com/reel/Cr9hF0QBywM/"
	fmt.Println(Cookie)
	ids := []string{}
	for _, u := range OpenList() {
		id := getInstagramID(u.Link)
		fmt.Println(u.Link)
		if id == "" {
			fmt.Println("Invalid URL")
			return
		}
		ids = append(ids, id)
	}
	u, _ := url.Parse(urls)
	q := u.Query()
	q.Set("variables", fmt.Sprintf(`{"shortcode":"%v"}`, ids[0]))
	q.Set("doc_id", "10015901848480474")
	q.Set("lsd", "AVqbxe3J_YA")
	u.RawQuery = q.Encode()
	fmt.Println(u)
	req, _ := http.NewRequest("POST", u.String(), nil)
	// set header
	req.Header.Set("User-Agent", userAgent)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("X-IG-App-ID", xIgAppId)
	req.Header.Set("X-FB-LSD", "AVqbxe3J_YA")
	req.Header.Set("X-ASBD-ID", "129477")
	req.Header.Set("Sec-Fetch-Site", "same-origin")
	// req.Header.Set("Cookie", cookie)

	client := http.Client{}
	resp, respErr := client.Do(req)
	if respErr != nil {
		fmt.Println("error request")
		log.Fatal(respErr)
	}

	// readResp, _ := io.ReadAll(resp.Body)
	// fmt.Println(string(readResp))
	if resp.StatusCode != 200 {
		log.Println(resp.StatusCode)
		return
	}

	models := RespModels{}
	decodeErr := json.NewDecoder(resp.Body).Decode(&models)
	if decodeErr != nil {
		log.Println("Decode Err : ", decodeErr)
	}

	newData := models.RenewModels()
	newData.SaveJson()
}
