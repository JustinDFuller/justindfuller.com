package grass

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	cloudtasks "cloud.google.com/go/cloudtasks/apiv2"
	"cloud.google.com/go/cloudtasks/apiv2/cloudtaskspb"
	"github.com/SherClockHolmes/webpush-go"
	"google.golang.org/protobuf/types/known/timestamppb"
)

type Reminder struct {
	Time         time.Time             `json:"time"`
	Minutes      int                   `json:"minutes"`
	Subscription *webpush.Subscription `json:"subscription"`
}

type ReminderConfig struct {
	PublicKey  string `secretmanager:"reminder_public_key"`
	PrivateKey string `secretmanager:"reminder_private_key"`
	Subscriber string `secretmanager:"reminder_subscriber"`
}

func SetHandler(w http.ResponseWriter, r *http.Request) {
	client, err := cloudtasks.NewClient(r.Context())
	if err != nil {
		log.Printf("Error creating cloud task client: %s", err)
		http.Error(w, "Error creating reminder", http.StatusInternalServerError)

		return
	}
	defer client.Close()

	var reminder Reminder
	if err := json.NewDecoder(r.Body).Decode(&reminder); err != nil {
		log.Printf("Error decoding body: %s", err)
		http.Error(w, "Error creating reminder", http.StatusInternalServerError)

		return
	}

	if err := r.Body.Close(); err != nil {
		log.Printf("Error closing request body: %s", err)
		http.Error(w, "Error creating reminder", http.StatusInternalServerError)

		return
	}

	task := &cloudtaskspb.CreateTaskRequest{
		Parent: "projects/justindfuller/locations/us-central1/queues/grass",
		Task: &cloudtaskspb.Task{
			// https://godoc.org/google.golang.org/genproto/googleapis/cloud/tasks/v2#AppEngineHttpRequest
			ScheduleTime: timestamppb.New(reminder.Time),
			MessageType: &cloudtaskspb.Task_AppEngineHttpRequest{
				AppEngineHttpRequest: &cloudtaskspb.AppEngineHttpRequest{
					HttpMethod:  cloudtaskspb.HttpMethod_POST,
					RelativeUri: "/reminder/send",
				},
			},
		},
	}

	body, err := json.Marshal(reminder)
	if err != nil {
		log.Printf("Error encoding reminder: %s", err)
		http.Error(w, "Error creating reminder", http.StatusInternalServerError)

		return
	}

	task.Task.GetAppEngineHttpRequest().Body = body

	createdTask, err := client.CreateTask(r.Context(), task)
	if err != nil {
		log.Printf("Error creating reminder: %s", err)
		http.Error(w, "Error creating reminder", http.StatusInternalServerError)

		return
	}

	log.Printf("Created task: %v", createdTask)
}

func SendHandler(reminderConfig ReminderConfig) func(http.ResponseWriter, *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		var reminder Reminder
		if err := json.NewDecoder(r.Body).Decode(&reminder); err != nil {
			log.Printf("Error decoding body: %s", err)
			http.Error(w, "Error sending reminder", http.StatusInternalServerError)

			return
		}

		body, err := json.Marshal(reminder)
		if err != nil {
			log.Printf("Error encoding body: %s", err)
			http.Error(w, "Error sending reminder", http.StatusInternalServerError)

			return
		}

		resp, err := webpush.SendNotification(body, reminder.Subscription, &webpush.Options{
			Subscriber:      reminderConfig.Subscriber,
			VAPIDPublicKey:  reminderConfig.PublicKey,
			VAPIDPrivateKey: reminderConfig.PrivateKey,
			TTL:             1000 * 60 * 60 * 12, // 12 hours
		})
		if err != nil {
			log.Printf("Error sending push notification: %s", err)
			http.Error(w, "Error creating reminder", http.StatusInternalServerError)

			return
		}

		if err := resp.Body.Close(); err != nil {
			log.Printf("Error closing response body: %s", err)
			http.Error(w, "Error creating reminder", http.StatusInternalServerError)

			return
		}

		log.Printf("Sent push notification: %v", r)
	}
}
