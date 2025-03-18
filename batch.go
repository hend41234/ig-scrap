package main

// import (
// 	"bytes"
// 	"encoding/json"
// 	"fmt"
// 	"log"
// 	"net/http"
// 	"net/url"
// 	"regexp"
// )

// var (
// 	userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" // Sesuaikan dengan yang ada di ENV
// 	xIgAppId  = "936619743392459"                           // Sesuaikan dengan yang ada di ENV
// 	cookie    = `csrftoken=eOLvV30Z7t2EvyGg2JKvsK; datr=P9XNZ7uTRFlix-_JJ1JZNz5c; ig_did=152C407D-45DE-4069-866F-7518A97E4281; ps_l=1; ps_n=1; mid=Z83VPwALAAEZPO12tKckBnJbFJYD; ds_user_id=4311759841; sessionid=4311759841%3AMZB0s5sbSnwgTu%3A16%3AAYe-oIipR6v2EbyDvGq7b_iipv7s0vUjU3YYh5L5EQ; wd=1158x311; rur="HIL\0544311759841\0541773742607:01f7ff831fcb91405236c1e459911f8338488914c60cd4ff11d4eff46fb8a6af7c05ce0c"`
// )

// type EdgeMediaToCaption struct {
// 	Edges []struct {
// 		Node struct {
// 			Text string `json:"text"`
// 		} `json:"node"`
// 	} `json:"edges"`
// }
// type DataStruct struct {
// 	XDTShortcodeMedia struct {
// 		VideoUrl      string             `json:"video_url"`
// 		VideoDuration float64            `json:"video_duration"`
// 		EdgeMTC       EdgeMediaToCaption `json:"edge_media_to_caption"`
// 	} `json:"xdt_shortcode_media"`
// }
// type RespModels struct {
// 	Data DataStruct `json:"data"`
// }

// type NewDataModels struct {
// 	VideoUrl      string  `json:"video_url"`
// 	VideoDuration float64 `json:"video_duration"`
// 	Caption       string  `json:"caption"`
// }
// type NewResponseModels []NewDataModels

// type OK struct {
// 	Code int `json:"code"`
// }

// func getInstagramID(url string) string {
// 	// Regex untuk menangkap ID dari berbagai format URL Instagram
// 	re := regexp.MustCompile(`(?:instagram\.com\/(?:p|reel|reels|stories)\/)([A-Za-z0-9-_]+)`)

// 	// Mencari hasil match dari URL
// 	match := re.FindStringSubmatch(url)

// 	// Jika match ditemukan, ID ada di index ke-1
// 	if len(match) > 1 {
// 		return match[1]
// 	}
// 	return ""
// }

// var listUrl []string

// func (old_data RespModels) RenewModels() (new_data NewResponseModels) {
// 	new_data = append(new_data, NewDataModels{
// 		VideoUrl:      old_data.Data.XDTShortcodeMedia.VideoUrl,
// 		VideoDuration: old_data.Data.XDTShortcodeMedia.VideoDuration,
// 		Caption:       old_data.Data.XDTShortcodeMedia.EdgeMTC.Edges[0].Node.Text,
// 	})
// 	return
// }

// type BatchModels struct {
// 	Method      string `json:"method"`
// 	RelativeUrl string `json:"relative_url"`
// 	Body        string `json:"body"`
// }

// func main() {
// 	listUrl = []string{
// 		"https://www.instagram.com/reel/Cr9hF0QBywM",
// 		"https://www.instagram.com/reel/Cr9hF0QBywM",
// 		// "https://www.instagram.com/reel/AEcvNMPd0KiIzIeMqt3t0MF",
// 	}
// 	urls := "https://www.instagram.com/api/graphqlbatch"
// 	//https://www.instagram.com/api/graphql?variables={"shortcode":"Cr9hF0QBywM"}&doc_id=10015901848480474&lsd=AVqbxe3J_YA
// 	// content := "https://www.instagram.com/reel/Cr9hF0QBywM/"
// 	BModels := []BatchModels{}
// 	for _, u := range listUrl {
// 		id := getInstagramID(u)
// 		if id == "" {
// 			fmt.Println("Invalid URL")
// 			return
// 		}
// 		// ids = append(ids, id)
// 		// q.Set("variables", fmt.Sprintf(`{"shortcode":"%v"}`, id))
// 		// q.Set("doc_id", "10015901848480474")
// 		// q.Set("lsd", "AVqbxe3J_YA")
// 		BModels = append(BModels, BatchModels{
// 			Method:      "POST",
// 			RelativeUrl: "/api/graphql",
// 			Body:        fmt.Sprintf("variables={'shortcode':'%v'}&doc_id=10015901848480474&lsd=AVqbxe3J_YA", id),
// 		})
// 	}
// 	Bstring, _ := json.Marshal(BModels)
// 	payload := url.Values{}
// 	payload.Add("batch", (string(Bstring)))
// 	// u.RawQuery = q.Encode()
// 	fmt.Println(payload.Encode())
// 	// fmt.Println(payload.Encode())
// 	req, _ := http.NewRequest("POST", urls, bytes.NewBuffer([]byte(payload.Encode())))
// 	// set header
// 	req.Header.Set("User-Agent", userAgent)
// 	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
// 	req.Header.Set("X-IG-App-ID", xIgAppId)
// 	req.Header.Set("X-FB-LSD", "AVqbxe3J_YA")
// 	req.Header.Set("X-ASBD-ID", "129477")
// 	req.Header.Set("Sec-Fetch-Site", "same-origin")
// 	// req.Header.Set("Cookie", cookie)
// 	fmt.Println(req.URL.String())
// 	client := http.Client{}
// 	resp, respErr := client.Do(req)
// 	if respErr != nil {
// 		fmt.Println("error request")
// 		log.Fatal(respErr)
// 	}
// 	// readResp, _ := io.ReadAll(resp.Body)
// 	// fmt.Println(string(readResp))
// 	// models := RespModels{}
// 	// decodeErr := json.NewDecoder(resp.Body).Decode(&models)
// 	// if decodeErr != nil {
// 	// log.Println("Decode Err : ", decodeErr)
// 	// }
// 	if resp.StatusCode != 200 {
// 		log.Println(resp.StatusCode)
// 		return
// 	}
// 	// fmt.Println(models.Data)
// 	// newData := models.RenewModels()
// 	// fmt.Println(newData[0].VideoUrl)
// }
