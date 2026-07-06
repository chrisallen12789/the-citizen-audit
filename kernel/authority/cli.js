const { checkAction, listAuthorityProblems } = require("./engine");

function main(argv = process.argv.slice(2)) {
  const [agentId, action] = argv;
  if (!agentId || !action) {
    const problems = listAuthorityProblems();
    console.log("Citizen Audit Authority Engine");
    console.log("");
    console.log(`Authority problems: ${problems.length}`);
    if (problems.length) for (const problem of problems) console.log(`- ${problem}`);
    return problems.length ? 1 : 0;
  }
  const result = checkAction(agentId, action);
  console.log(JSON.stringify(result, null, 2));
  return result.allowed ? 0 : 1;
}

if (require.main === module) process.exitCode = main();

module.exports = { main };
