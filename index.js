import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import fs from "fs/promises";
import path from "path";
import chalk from "chalk";

const getFormattedDate = () => {
  const now = new Date();
  const pad = (num) => String(num).padStart(2, "0");
  return `${pad(now.getDate())}-${pad(
    now.getMonth() + 1
  )}-${now.getFullYear()}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
};

let links;

const loadLinks = async () => {
  try {
    const data = await fs.readFile("links.json", "utf8");
    links = JSON.parse(data).socialMediaLinks;
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error(
        "links.json file not found. Please ensure it exists in the current directory."
      );
    } else if (error instanceof SyntaxError) {
      throw new Error(
        "Invalid JSON in links.json. Please check the file format."
      );
    } else {
      throw new Error(`Failed to load links: ${error.message}`);
    }
  }
};

const generateSearchUrls = (formattedName) =>
  links.map(
    (link) =>
      `${link.name}: ${link.url.replace(
        "{query}",
        encodeURIComponent(formattedName)
      )}`
  );

const generateSummary = (searchResults) => {
  const platformCounts = searchResults.reduce((acc, result) => {
    const platform = result.split(":")[0].trim();
    acc[platform] = (acc[platform] || 0) + 1;
    return acc;
  }, {});

  const totalLinks = searchResults.length;

  let summary = `+-------------------+\n`;
  summary += `|   Summary Report   |\n`;
  summary += `+-------------------+\n\n`;
  summary += `Total links generated: ${totalLinks}\n\n`;
  summary += `Breakdown by platform:\n`;
  summary += `----------------------\n`;

  Object.entries(platformCounts).forEach(([platform, count]) => {
    summary += `${platform.padEnd(20)} ${count} link(s)\n`;
  });

  summary += `\n+-------------------+\n`;

  return summary;
};

const loadingAnimation = () => {
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let i = 0;
  return new Promise((resolve) => {
    const interval = setInterval(() => {
      process.stdout.write(
        `\r${chalk.green(`Generating ${frames[i++ % frames.length]}`)}`
      );
    }, 80);
    setTimeout(() => {
      clearInterval(interval);
      process.stdout.write(`\r${chalk.green("Finished Generating")}     \n`);
      resolve();
    }, 2000);
  });
};

const formatResults = (searchResults) => {
  let formattedResults = `+------------------------+\n`;
  formattedResults += `|     Search Results     |\n`;
  formattedResults += `+------------------------+\n\n`;

  searchResults.forEach((result) => {
    const [platform, url] = result.split(": ");
    formattedResults += `${platform.padEnd(20)}\n${url}\n\n`;
  });

  formattedResults += `+------------------------+\n`;

  return formattedResults;
};

const handleCommand = async (argv, isFind) => {
  try {
    if (!links) {
      await loadingAnimation();
      await loadLinks();
    }

    const formattedName = argv.name.replace(/ /g, "+");
    const dirName = path.join(
      "results",
      `Results-${argv.name.replace(/ /g, "_")}`
    );
    const fileName = path.join(dirName, `Results-${getFormattedDate()}.txt`);

    await fs.mkdir(dirName, { recursive: true });

    const searchResults = generateSearchUrls(formattedName);
    const formattedResults = formatResults(searchResults);
    await fs.writeFile(fileName, formattedResults, "utf8");

    console.log(chalk.green(`Results saved to ${chalk.bold(fileName)}`));

    if (!isFind) {
      const summaryFileName = path.join(
        dirName,
        `Summary-${getFormattedDate()}.txt`
      );
      const summary = generateSummary(searchResults);
      await fs.writeFile(summaryFileName, summary, "utf8");
      console.log(
        chalk.green(`Summary report saved to ${chalk.bold(summaryFileName)}`)
      );
    }
  } catch (error) {
    console.error(chalk.red("An error occurred:"), error.message);
    if (error.code === "ENOENT") {
      console.error(
        chalk.yellow(
          "Make sure the 'links.json' file exists in the current directory."
        )
      );
    } else if (error instanceof SyntaxError) {
      console.error(
        chalk.yellow(
          "The 'links.json' file contains invalid JSON. Please check its format."
        )
      );
    }
    process.exit(1);
  }
};

const deleteResults = async () => {
  try {
    const resultsExist = await fs
      .access("results")
      .then(() => true)
      .catch(() => false);
    if (resultsExist) {
      await fs.rm("results", { recursive: true, force: true });
      console.log(chalk.green("Results folder has been deleted."));
    } else {
      console.log(
        chalk.yellow("Results folder does not exist. Nothing to delete.")
      );
    }
  } catch (error) {
    console.error(
      chalk.red("An error occurred while deleting results:"),
      error.message
    );
  }
};

const argv = yargs(hideBin(process.argv))
  .scriptName("oracle")
  .usage("$0 <cmd> [args]")
  .demandCommand(1, "You need to provide one of the arguments below")
  .example('oracle find "Lorem Ipsum"')
  .example('oracle summary "Lorem Ipsum"')
  .example("oracle delete")
  .command(
    "find <name>",
    "Search someone across multiple platforms",
    (yargs) => {
      yargs.positional("name", { describe: "person to find", type: "string" });
    },
    async (argv) => {
      await handleCommand(argv, true);
    }
  )
  .command(
    "summary <name>",
    "Generate a summary report of the findings",
    (yargs) => {
      yargs.positional("name", {
        describe: "person to generate summary for",
        type: "string",
      });
    },
    async (argv) => {
      await handleCommand(argv, false);
    }
  )
  .command(
    "delete",
    "Deletes the results folder",
    () => {},
    async () => {
      await deleteResults();
    }
  )
  .check((argv) => {
    const validCommands = ["find", "summary", "delete"];
    if (!validCommands.includes(argv._[0])) {
      throw new Error(`Invalid command: ${argv._[0]}. use --help`);
    }
    return true;
  })
  .fail((msg, err, yargs) => {
    if (err) {
      console.error(chalk.red("An error occurred:"), err.message);
    } else {
      console.error(chalk.red(msg));
      console.log(chalk.red(yargs.help()));
    }
    process.exit(1);
  })
  .help().argv;
