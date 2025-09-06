package programming

import (
	"bytes"
	_ "embed"
	"html/template"
	"time"

	"github.com/yuin/goldmark"
	meta "github.com/yuin/goldmark-meta"
	"github.com/yuin/goldmark/extension"
	"github.com/yuin/goldmark/parser"
	"github.com/yuin/goldmark/renderer/html"
)

type Entry struct {
	Title       string
	Slug        string
	Description string
	Content     template.HTML
	Date        time.Time
}

//go:embed 2017-01-06_javascript-apis-video-api.md
var javascriptAPIsVideoAPI string

//go:embed 2017-01-07_javascript-apis-console.md
var javascriptAPIsConsole string

//go:embed 2017-01-11_javascript-apis-battery.md
var javascriptAPIsBattery string

//go:embed 2017-01-16_how-to-copy-to-a-users-clipboard-with-only-javascript.md
var howToCopyToClipboard string

//go:embed 2017-01-27_easily-create-an-html-editor-with-designmode-and-contenteditable.md
var easilyCreateHTMLEditor string

//go:embed 2017-02-13_three-reasons-i-avoid-anonymous-js-functions-like-the-plague.md
var threeReasonsAvoidAnonymousFunctions string

//go:embed 2017-03-20_continuous-deployment-for-node-js-on-digitalocean.md
var continuousDeploymentNodeJS string

//go:embed 2017-11-09_function-composition-with-lodash.md
var functionCompositionLodash string

//go:embed 2017-11-13_lets-compose-promises.md
var letsComposePromises string

//go:embed 2018-04-06_here-are-three-upcoming-changes-to-javascript-that-youll-love.md
var threeUpcomingJSChanges string

//go:embed 2018-05-21_why-you-should-use-functional-composition-for-your-full-applications.md
var whyUseFunctionalComposition string

//go:embed 2018-08-23_introducing-promise-funnel.md
var introducingPromiseFunnel string

//go:embed 2018-09-18_how-to-understand-any-programming-task.md
var howToUnderstandProgrammingTask string

//go:embed 2018-10-17_how-writing-tests-can-make-you-a-faster-and-more-productive-developer.md
var howWritingTestsMakesFaster string

//go:embed 2018-10-17_simply-javascript-a-straightforward-intro-to-mocking-stubbing-and-interfaces.md
var simplyJavaScriptMocking string

//go:embed 2018-11-28_how-to-write-error-messages-that-dont-suck.md
var howToWriteErrorMessages string

//go:embed 2019-01-24_refactoring-oops-ive-been-doing-it-backwards.md
var refactoringBackwards string

//go:embed 2019-07-19_service-calls-make-your-tests-better.md
var serviceCallsMakeTestsBetter string

//go:embed 2019-10-13_Person-Knowledge-Repo.md
var personKnowledgeRepo string

//go:embed 2019-12-14_go_things_i_love_methods_on_any_type.md
var goThingsILoveMethodsOnAnyType string

//go:embed 2020-01-06_go-things-i-love-channels-and-goroutines.md
var goThingsILoveChannelsGoroutines string

//go:embed 2020-01-21_why-do-we-fall-into-the-rewrite-trap.md
var whyRewriteTrap string

//go:embed 2022-05-09_binary_search.md
var binarySearch string

//go:embed 2022-10-09_just_say_no_to_helper_functions.md
var justSayNoToHelperFunctions string

//go:embed 2022-10-09_representing_reality.md
var representingReality string

//go:embed 2022-11-30_self_documenting_code.md
var selfDocumentingCode string

//go:embed 2022-12-01_go_tip_function_arguments.md
var goTipFunctionArguments string

//go:embed 2022-12-19_technical_roadmaps.md
var technicalRoadmaps string

//go:embed 2023-02-11_my_javascript_style_guide.md
var myJavaScriptStyleGuide string

func parseMarkdown(content string) template.HTML {
	md := goldmark.New(
		goldmark.WithExtensions(extension.GFM, meta.Meta),
		goldmark.WithParserOptions(
			parser.WithAutoHeadingID(),
		),
		goldmark.WithRendererOptions(
			html.WithHardWraps(),
			html.WithUnsafe(),
		),
	)

	var buf bytes.Buffer
	if err := md.Convert([]byte(content), &buf); err != nil {
		// If parsing fails, return the original content
		return template.HTML(content)
	}

	return template.HTML(buf.String())
}

var Entries = []Entry{
	{
		Title:       "My JavaScript Style Guide",
		Slug:        "my-javascript-style-guide",
		Description: "A comprehensive JavaScript style guide for writing clean, maintainable code",
		Content:     parseMarkdown(myJavaScriptStyleGuide),
		Date:        time.Date(2023, 2, 11, 0, 0, 0, 0, time.UTC),
	},
	{
		Title:       "Technical Roadmaps",
		Slug:        "technical-roadmaps",
		Description: "How to create and use technical roadmaps effectively",
		Content:     parseMarkdown(technicalRoadmaps),
		Date:        time.Date(2022, 12, 19, 0, 0, 0, 0, time.UTC),
	},
	{
		Title:       "Go Tip: Function Arguments",
		Slug:        "go-tip-function-arguments",
		Description: "Tips for working with function arguments in Go",
		Content:     parseMarkdown(goTipFunctionArguments),
		Date:        time.Date(2022, 12, 1, 0, 0, 0, 0, time.UTC),
	},
	{
		Title:       "Self-Documenting Code",
		Slug:        "self-documenting-code",
		Description: "Writing code that documents itself",
		Content:     parseMarkdown(selfDocumentingCode),
		Date:        time.Date(2022, 11, 30, 0, 0, 0, 0, time.UTC),
	},
	{
		Title:       "Representing Reality",
		Slug:        "representing-reality",
		Description: "How to model real-world concepts in code",
		Content:     parseMarkdown(representingReality),
		Date:        time.Date(2022, 10, 9, 0, 0, 0, 0, time.UTC),
	},
	{
		Title:       "Just Say No to Helper Functions",
		Slug:        "just-say-no-to-helper-functions",
		Description: "Why helper functions can be harmful and what to do instead",
		Content:     parseMarkdown(justSayNoToHelperFunctions),
		Date:        time.Date(2022, 10, 9, 0, 0, 0, 0, time.UTC),
	},
	{
		Title:       "Binary Search",
		Slug:        "binary-search",
		Description: "Understanding and implementing binary search",
		Content:     parseMarkdown(binarySearch),
		Date:        time.Date(2022, 5, 9, 0, 0, 0, 0, time.UTC),
	},
	{
		Title:       "Why Do We Fall Into the Rewrite Trap?",
		Slug:        "why-do-we-fall-into-the-rewrite-trap",
		Description: "Understanding the temptation to rewrite code from scratch",
		Content:     parseMarkdown(whyRewriteTrap),
		Date:        time.Date(2020, 1, 21, 0, 0, 0, 0, time.UTC),
	},
	{
		Title:       "Go Things I Love: Channels and Goroutines",
		Slug:        "go-things-i-love-channels-and-goroutines",
		Description: "Exploring Go's concurrency primitives",
		Content:     parseMarkdown(goThingsILoveChannelsGoroutines),
		Date:        time.Date(2020, 1, 6, 0, 0, 0, 0, time.UTC),
	},
	{
		Title:       "Go Things I Love: Methods on Any Type",
		Slug:        "go-things-i-love-methods-on-any-type",
		Description: "The power of Go's type system and methods",
		Content:     parseMarkdown(goThingsILoveMethodsOnAnyType),
		Date:        time.Date(2019, 12, 14, 0, 0, 0, 0, time.UTC),
	},
	{
		Title:       "Person Knowledge Repo",
		Slug:        "person-knowledge-repo",
		Description: "Building a personal knowledge repository",
		Content:     parseMarkdown(personKnowledgeRepo),
		Date:        time.Date(2019, 10, 13, 0, 0, 0, 0, time.UTC),
	},
	{
		Title:       "Service Calls Make Your Tests Better",
		Slug:        "service-calls-make-your-tests-better",
		Description: "How service-oriented architecture improves testability",
		Content:     parseMarkdown(serviceCallsMakeTestsBetter),
		Date:        time.Date(2019, 7, 19, 0, 0, 0, 0, time.UTC),
	},
	{
		Title:       "Refactoring: Oops, I've Been Doing It Backwards",
		Slug:        "refactoring-oops-ive-been-doing-it-backwards",
		Description: "A new perspective on the refactoring process",
		Content:     parseMarkdown(refactoringBackwards),
		Date:        time.Date(2019, 1, 24, 0, 0, 0, 0, time.UTC),
	},
	{
		Title:       "How to Write Error Messages That Don't Suck",
		Slug:        "how-to-write-error-messages-that-dont-suck",
		Description: "Guidelines for writing helpful error messages",
		Content:     parseMarkdown(howToWriteErrorMessages),
		Date:        time.Date(2018, 11, 28, 0, 0, 0, 0, time.UTC),
	},
	{
		Title:       "Simply JavaScript: A Straightforward Intro to Mocking, Stubbing, and Interfaces",
		Slug:        "simply-javascript-mocking-stubbing-interfaces",
		Description: "Understanding testing concepts in JavaScript",
		Content:     parseMarkdown(simplyJavaScriptMocking),
		Date:        time.Date(2018, 10, 17, 0, 0, 0, 0, time.UTC),
	},
	{
		Title:       "How Writing Tests Can Make You a Faster and More Productive Developer",
		Slug:        "how-writing-tests-makes-you-faster",
		Description: "The counterintuitive benefits of test-driven development",
		Content:     parseMarkdown(howWritingTestsMakesFaster),
		Date:        time.Date(2018, 10, 17, 0, 0, 0, 0, time.UTC),
	},
	{
		Title:       "How to Understand Any Programming Task",
		Slug:        "how-to-understand-any-programming-task",
		Description: "A systematic approach to tackling programming problems",
		Content:     parseMarkdown(howToUnderstandProgrammingTask),
		Date:        time.Date(2018, 9, 18, 0, 0, 0, 0, time.UTC),
	},
	{
		Title:       "Introducing Promise Funnel",
		Slug:        "introducing-promise-funnel",
		Description: "A new pattern for handling promises in JavaScript",
		Content:     parseMarkdown(introducingPromiseFunnel),
		Date:        time.Date(2018, 8, 23, 0, 0, 0, 0, time.UTC),
	},
	{
		Title:       "Why You Should Use Functional Composition for Your Full Applications",
		Slug:        "why-use-functional-composition",
		Description: "The benefits of functional composition at scale",
		Content:     parseMarkdown(whyUseFunctionalComposition),
		Date:        time.Date(2018, 5, 21, 0, 0, 0, 0, time.UTC),
	},
	{
		Title:       "Here Are Three Upcoming Changes to JavaScript That You'll Love",
		Slug:        "three-upcoming-javascript-changes",
		Description: "Exciting new JavaScript features on the horizon",
		Content:     parseMarkdown(threeUpcomingJSChanges),
		Date:        time.Date(2018, 4, 6, 0, 0, 0, 0, time.UTC),
	},
	{
		Title:       "Let's Compose Promises",
		Slug:        "lets-compose-promises",
		Description: "Using functional composition with JavaScript promises",
		Content:     parseMarkdown(letsComposePromises),
		Date:        time.Date(2017, 11, 13, 0, 0, 0, 0, time.UTC),
	},
	{
		Title:       "Function Composition with Lodash",
		Slug:        "function-composition-with-lodash",
		Description: "Learning functional composition using Lodash",
		Content:     parseMarkdown(functionCompositionLodash),
		Date:        time.Date(2017, 11, 9, 0, 0, 0, 0, time.UTC),
	},
	{
		Title:       "Continuous Deployment for Node.js on DigitalOcean",
		Slug:        "continuous-deployment-nodejs-digitalocean",
		Description: "Setting up automated deployment for Node.js applications",
		Content:     parseMarkdown(continuousDeploymentNodeJS),
		Date:        time.Date(2017, 3, 20, 0, 0, 0, 0, time.UTC),
	},
	{
		Title:       "Three Reasons I Avoid Anonymous JS Functions Like the Plague",
		Slug:        "three-reasons-avoid-anonymous-functions",
		Description: "Why named functions are better than anonymous ones",
		Content:     parseMarkdown(threeReasonsAvoidAnonymousFunctions),
		Date:        time.Date(2017, 2, 13, 0, 0, 0, 0, time.UTC),
	},
	{
		Title:       "Easily Create an HTML Editor with DesignMode and ContentEditable",
		Slug:        "easily-create-html-editor",
		Description: "Building rich text editors with browser APIs",
		Content:     parseMarkdown(easilyCreateHTMLEditor),
		Date:        time.Date(2017, 1, 27, 0, 0, 0, 0, time.UTC),
	},
	{
		Title:       "How to Copy to a User's Clipboard with Only JavaScript",
		Slug:        "copy-to-clipboard-javascript",
		Description: "Implementing clipboard functionality in the browser",
		Content:     parseMarkdown(howToCopyToClipboard),
		Date:        time.Date(2017, 1, 16, 0, 0, 0, 0, time.UTC),
	},
	{
		Title:       "JavaScript APIs: Battery",
		Slug:        "javascript-apis-battery",
		Description: "Exploring the Battery Status API",
		Content:     parseMarkdown(javascriptAPIsBattery),
		Date:        time.Date(2017, 1, 11, 0, 0, 0, 0, time.UTC),
	},
	{
		Title:       "JavaScript APIs: Console",
		Slug:        "javascript-apis-console",
		Description: "Advanced console methods for better debugging",
		Content:     parseMarkdown(javascriptAPIsConsole),
		Date:        time.Date(2017, 1, 7, 0, 0, 0, 0, time.UTC),
	},
	{
		Title:       "JavaScript APIs: Video API",
		Slug:        "javascript-apis-video-api",
		Description: "Working with HTML5 video elements programmatically",
		Content:     parseMarkdown(javascriptAPIsVideoAPI),
		Date:        time.Date(2017, 1, 6, 0, 0, 0, 0, time.UTC),
	},
}