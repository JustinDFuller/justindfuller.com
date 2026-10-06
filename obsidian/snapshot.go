package obsidian

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"path"
	"reflect"
	"regexp"
	"strings"
	"unicode/utf8"
)

const MaximumSnapshotBytes = 8 * 1024 * 1024

type ObjectMetadata struct {
	Size        int64
	ContentType string
	SHA256      string
	MD5         string
}

type ObjectReader interface {
	Read(context.Context, string, int64) ([]byte, error)
	Head(context.Context, string) (ObjectMetadata, error)
}

type LoadedSource struct {
	Snapshot SourceSnapshot    `json:"snapshot"`
	Revision string            `json:"revision"`
	Bodies   map[string][]byte `json:"bodies"`
	Ready    map[string]bool   `json:"ready"`
}

func SHA256(body []byte) string {
	sum := sha256.Sum256(body)
	return hex.EncodeToString(sum[:])
}

func CanonicalSnapshot(snapshot SourceSnapshot) ([]byte, error) {
	var buf bytes.Buffer
	encoder := json.NewEncoder(&buf)
	encoder.SetEscapeHTML(false)
	if err := encoder.Encode(snapshot); err != nil {
		return nil, err
	}
	return bytes.TrimSuffix(buf.Bytes(), []byte("\n")), nil
}

func DecodeStrict(body []byte, destination any) error {
	if !utf8.Valid(body) {
		return errors.New("invalid control document encoding")
	}
	decoder := json.NewDecoder(bytes.NewReader(body))
	if err := uniqueJSON(decoder); err != nil {
		return err
	}
	if _, err := decoder.Token(); err != io.EOF {
		return errors.New("trailing control data")
	}
	decoder = json.NewDecoder(bytes.NewReader(body))
	decoder.DisallowUnknownFields()
	var value any
	if err := json.Unmarshal(body, &value); err != nil {
		return err
	}
	if destination == nil || reflect.TypeOf(destination).Kind() != reflect.Pointer {
		return errors.New("control destination must be a pointer")
	}
	if err := exactJSONFields(value, reflect.TypeOf(destination).Elem()); err != nil {
		return err
	}
	return decoder.Decode(destination)
}

func exactJSONFields(value any, kind reflect.Type) error {
	for kind.Kind() == reflect.Pointer {
		kind = kind.Elem()
	}
	switch kind.Kind() {
	case reflect.Struct:
		object, ok := value.(map[string]any)
		if !ok {
			return nil
		}
		fields := map[string]reflect.Type{}
		for i := range kind.NumField() {
			field := kind.Field(i)
			if field.PkgPath != "" {
				continue
			}
			name := strings.Split(field.Tag.Get("json"), ",")[0]
			if name == "-" {
				continue
			}
			if name == "" {
				name = field.Name
			}
			fields[name] = field.Type
		}
		for key, nested := range object {
			field, found := fields[key]
			if !found {
				return errors.New("unknown control document field")
			}
			if err := exactJSONFields(nested, field); err != nil {
				return err
			}
		}
	case reflect.Map:
		if object, ok := value.(map[string]any); ok {
			for _, nested := range object {
				if err := exactJSONFields(nested, kind.Elem()); err != nil {
					return err
				}
			}
		}
	case reflect.Array, reflect.Slice:
		if array, ok := value.([]any); ok {
			for _, nested := range array {
				if err := exactJSONFields(nested, kind.Elem()); err != nil {
					return err
				}
			}
		}
	}
	return nil
}

func uniqueJSON(decoder *json.Decoder) error {
	token, err := decoder.Token()
	if err != nil {
		return err
	}
	delim, ok := token.(json.Delim)
	if !ok {
		return nil
	}
	switch delim {
	case '{':
		seen := map[string]bool{}
		for decoder.More() {
			token, err := decoder.Token()
			if err != nil {
				return err
			}
			key, ok := token.(string)
			if !ok || seen[key] {
				return errors.New("duplicate or invalid control key")
			}
			seen[key] = true
			if err := uniqueJSON(decoder); err != nil {
				return err
			}
		}
	case '[':
		for decoder.More() {
			if err := uniqueJSON(decoder); err != nil {
				return err
			}
		}
	default:
		return errors.New("invalid control structure")
	}
	_, err = decoder.Token()
	return err
}

func validSourcePath(name string) bool {
	return name != "" && !strings.ContainsAny(name, "\\\x00\r\n") && !strings.HasPrefix(name, "/") && path.Clean(name) == name && name != ".." && !strings.HasPrefix(name, "../")
}

func validImageRecord(name string, record ImageRecord) bool {
	if !validSourcePath(name) || !strings.HasPrefix(name, "image/") || !isSupportedImage(name) {
		return false
	}
	ext := path.Ext(name)
	return regexp.MustCompile(`^[a-f0-9]{64}$`).MatchString(record.SHA256) && regexp.MustCompile(`^[a-f0-9]{32}$`).MatchString(record.MD5) && record.Size > 0 && record.Size <= 20*1024*1024 && record.ContentType == imageContentType(name) && record.Key == "v1/"+record.SHA256+ext
}

func ValidateSnapshot(snapshot SourceSnapshot) error {
	if snapshot.Version != 1 || snapshot.Files == nil || snapshot.Images == nil || len(snapshot.Images) > 10000 {
		return errors.New("invalid source snapshot schema")
	}
	encoded, err := CanonicalSnapshot(snapshot)
	if err != nil || len(encoded) > MaximumSnapshotBytes {
		return errors.New("source snapshot exceeds protocol limit")
	}
	images, err := json.Marshal(snapshot.Images)
	if err != nil || len(images) > 2*1024*1024 {
		return errors.New("image metadata exceeds protocol limit")
	}
	for name, record := range snapshot.Files {
		if !validSourcePath(name) || strings.Contains(name, "/") || !strings.HasSuffix(name, ".md") || !regexp.MustCompile(`^[a-f0-9]{64}$`).MatchString(record.SHA256) || record.Size < 0 || record.Key != "markdown/v1/"+record.SHA256+".md" {
			return errors.New("invalid source file record")
		}
	}
	for name, record := range snapshot.Images {
		if !validImageRecord(name, record) {
			return errors.New("invalid source image record")
		}
	}
	return nil
}

func ReadSource(ctx context.Context, reader ObjectReader) (LoadedSource, error) {
	var pointer struct {
		Version  int    `json:"version"`
		Revision string `json:"revision"`
	}
	body, err := reader.Read(ctx, "latest.json", 1024)
	if err != nil {
		return LoadedSource{}, err
	}
	if len(body) > 1024 || DecodeStrict(body, &pointer) != nil || pointer.Version != 1 || !regexp.MustCompile(`^[a-f0-9]{64}$`).MatchString(pointer.Revision) {
		return LoadedSource{}, errors.New("invalid source pointer")
	}
	body, err = reader.Read(ctx, "snapshots/"+pointer.Revision+".json", MaximumSnapshotBytes)
	if err != nil {
		return LoadedSource{}, err
	}
	var snapshot SourceSnapshot
	if len(body) > MaximumSnapshotBytes || DecodeStrict(body, &snapshot) != nil || ValidateSnapshot(snapshot) != nil {
		return LoadedSource{}, errors.New("invalid source snapshot")
	}
	canonical, err := CanonicalSnapshot(snapshot)
	if err != nil || SHA256(canonical) != pointer.Revision || !bytes.Equal(body, canonical) {
		return LoadedSource{}, errors.New("source revision integrity failure")
	}
	result := LoadedSource{Snapshot: snapshot, Revision: pointer.Revision, Bodies: map[string][]byte{}, Ready: map[string]bool{}}
	for name, record := range snapshot.Files {
		body, err := reader.Read(ctx, record.Key, record.Size)
		if err != nil {
			return LoadedSource{}, fmt.Errorf("source object read failed: %w", err)
		}
		if int64(len(body)) != record.Size || SHA256(body) != record.SHA256 {
			return LoadedSource{}, errors.New("source object integrity failure")
		}
		result.Bodies[name] = body
	}
	for _, record := range snapshot.Images {
		metadata, err := reader.Head(ctx, record.Key)
		result.Ready[record.Key] = err == nil && metadata.Size == record.Size && metadata.ContentType == record.ContentType && metadata.SHA256 == record.SHA256 && metadata.MD5 == record.MD5
	}
	return result, nil
}
